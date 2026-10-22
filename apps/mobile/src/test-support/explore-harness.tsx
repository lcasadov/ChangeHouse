import { screen } from '@testing-library/react-native';

import type { Home } from '../features/homes/homes-api';
import { authUser, FakeAuthService } from './fake-auth-service';
import { FakeBackend, me } from './fake-backend';
import { type DiscoveryCard, discoveryCard } from './fake-discovery';
import { completeHome } from './fake-homes';
import type { Match } from './fake-matches';
import { renderSessionApp } from './render-session-app';

/** Un usuario con vivienda publicada: el único que puede dar «Me gusta». */
export const OWNER = me({ roles: ['owner'], hasPublishedHome: true });

/** Un usuario sin vivienda publicada: mira, descarta, pero no da «Me gusta». */
export const SEEKER = me();

export const published = (overrides: Partial<Home> = {}) =>
  completeHome({ status: 'published', ...overrides });

const withArea = (areaName: string): Partial<DiscoveryCard> => ({
  location: { visibility: 'area', point: { lat: 40.4, lng: -3.7 }, areaName },
});

/** Tarjetas «Zona 1», «Zona 2»… en ese orden. */
export const zoneCards = (count: number) =>
  Array.from({ length: count }, (_, index) => discoveryCard(withArea(`Zona ${String(index + 1)}`)));

export const button = (name: string) => screen.getByRole('button', { name });

/** La tarjeta de esa zona, cuando está a la vista (la de debajo está oculta a los lectores de pantalla). */
export const cardWith = async (area: string) =>
  screen.findByRole('button', { name: new RegExp(`Piso en ${area}`) });

export interface ExploreOptions {
  profile?: ReturnType<typeof me>;
  homes?: readonly Home[];
  cards?: readonly DiscoveryCard[];
  pageSize?: number;
  theme?: 'light' | 'dark';
  /** Los matches que ya tiene la persona. */
  matches?: readonly Match[];
  /** La ruta con la que se abre la app (por defecto, «Explorar»). */
  url?: string;
}

/** Una persona dada de alta que abre «Explorar» con esas viviendas y esas tarjetas. */
export async function openExplore({
  profile = OWNER,
  homes = [published()],
  cards = zoneCards(3),
  pageSize,
  theme,
  matches,
  url,
}: ExploreOptions = {}) {
  const backend = new FakeBackend({
    registered: true,
    profile,
    homes,
    discoveryCards: cards,
    ...(matches ? { matches } : {}),
  });
  if (pageSize) backend.discovery.pageSize = pageSize;
  const view = await renderSessionApp({
    auth: new FakeAuthService({ initialUser: authUser() }),
    backend,
    ...(theme ? { theme } : {}),
    ...(url ? { url } : {}),
  });
  return { backend, homeId: homes[0]?.id ?? '', cards, view };
}
