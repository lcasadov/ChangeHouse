import type { HomeInput, HomePatch } from '@changehouse/shared';

import {
  editHome,
  type Home,
  type HomeLocation,
  newDraft,
  pauseHome,
  resumeHome,
  submitHome,
} from '../../domain/home/home.js';
import type { Clock } from '../clock.js';
import type { IdGenerator } from '../id-generator.js';
import { AddressNotResolvedError, HomeNotFoundError } from './errors.js';
import type { HomeRepository } from './home-repository.js';
import {
  type HomePublicView,
  type HomeView,
  type PhotoView,
  toHomePublicView,
  toHomeView,
  toPhotoViews,
} from './home-views.js';
import { ownHome } from './own-home.js';
import type { PhotoRepository } from './photo-repository.js';
import type { PhotoStorage } from './photo-storage.js';
import type { PlaceResolver } from './place-resolver.js';

export interface HomeDeps {
  homes: HomeRepository;
  photos: PhotoRepository;
  storage: PhotoStorage;
  places: PlaceResolver;
  clock: Clock;
  ids: IdGenerator;
}

/** El servidor resuelve el lugar elegido: nunca se confía en coordenadas ni barrios del cliente. */
async function resolveLocation(deps: HomeDeps, placeId: string): Promise<HomeLocation> {
  const location = await deps.places.resolve(placeId);
  if (location === null) throw new AddressNotResolvedError();
  return location;
}

/** Las fotos listas de una vivienda, ya con su URL pública. */
async function photosOf(deps: HomeDeps, homeId: string): Promise<PhotoView[]> {
  return toPhotoViews(await deps.photos.listReady(homeId), (path) => deps.storage.publicUrl(path));
}

async function createHome(deps: HomeDeps, ownerId: string, input: HomeInput): Promise<HomeView> {
  const { type, address, ...details } = input;
  const location = await resolveLocation(deps, address.placeId);
  const home = newDraft({
    id: deps.ids.next(),
    ownerId,
    now: deps.clock.now(),
    type,
    address: address.formatted,
    location,
    details,
  });
  await deps.homes.insert(home);
  return toHomeView(home, []);
}

async function updateHome(
  deps: HomeDeps,
  ownerId: string,
  homeId: string,
  patch: HomePatch,
): Promise<HomeView> {
  const home = await ownHome(deps.homes, ownerId, homeId);
  const { address, ...changes } = patch;
  const place = address
    ? { address: address.formatted, location: await resolveLocation(deps, address.placeId) }
    : undefined;
  const edited = editHome(home, { ...changes, place }, deps.clock.now());
  await deps.homes.save(edited);
  return toHomeView(edited, await photosOf(deps, homeId));
}

async function listMyHomes(deps: HomeDeps, ownerId: string): Promise<HomeView[]> {
  const homes = await deps.homes.listByOwner(ownerId);
  const ready = await deps.photos.listReadyByHomes(homes.map((home) => home.id));
  return homes.map((home) =>
    toHomeView(
      home,
      toPhotoViews(
        ready.filter((photo) => photo.homeId === home.id),
        (path) => deps.storage.publicUrl(path),
      ),
    ),
  );
}

/** Ficha completa para su propietario; forma pública si está publicada; si no, como si no existiera. */
async function getHome(
  deps: HomeDeps,
  viewerId: string,
  homeId: string,
): Promise<HomeView | HomePublicView> {
  const home = await deps.homes.findById(homeId);
  if (home?.ownerId === viewerId) return toHomeView(home, await photosOf(deps, homeId));
  if (home?.status === 'published') return toHomePublicView(home, await photosOf(deps, homeId));
  throw new HomeNotFoundError();
}

async function submitOwnHome(deps: HomeDeps, ownerId: string, homeId: string): Promise<HomeView> {
  const home = await ownHome(deps.homes, ownerId, homeId);
  const submitted = submitHome(home, await deps.photos.countReady(homeId), deps.clock.now());
  await deps.homes.save(submitted);
  return toHomeView(submitted, await photosOf(deps, homeId));
}

/** Aplica una transición de estado a una vivienda propia (ajena o inexistente: 404) y la guarda. */
async function transitionOwnHome(
  deps: HomeDeps,
  ownerId: string,
  homeId: string,
  transition: (home: Home) => Home,
): Promise<HomeView> {
  const changed = transition(await ownHome(deps.homes, ownerId, homeId));
  await deps.homes.save(changed);
  return toHomeView(changed, await photosOf(deps, homeId));
}

/** Los casos de uso de las viviendas con sus dependencias ya inyectadas, listos para el transporte. */
export function homeOperations(deps: HomeDeps) {
  return {
    createHome: (ownerId: string, input: HomeInput) => createHome(deps, ownerId, input),
    updateHome: (ownerId: string, homeId: string, patch: HomePatch) =>
      updateHome(deps, ownerId, homeId, patch),
    listMyHomes: (ownerId: string) => listMyHomes(deps, ownerId),
    getHome: (viewerId: string, homeId: string) => getHome(deps, viewerId, homeId),
    submitHome: (ownerId: string, homeId: string) => submitOwnHome(deps, ownerId, homeId),
    pauseHome: (ownerId: string, homeId: string) =>
      transitionOwnHome(deps, ownerId, homeId, pauseHome),
    resumeHome: (ownerId: string, homeId: string) =>
      transitionOwnHome(deps, ownerId, homeId, resumeHome),
  };
}
