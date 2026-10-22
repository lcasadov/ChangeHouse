import { FIXTURE_PLACES } from '@changehouse/shared';

import type { ConsentRepository } from '../src/application/account/consent-repository.js';
import type { HomeOwnership } from '../src/application/account/home-ownership.js';
import type { ProfileChanges, UserRepository } from '../src/application/account/user-repository.js';
import type { HomeRepository } from '../src/application/home/home-repository.js';
import type { ImageProcessor, ProcessedImage } from '../src/application/home/image-processor.js';
import type { PhotoRepository } from '../src/application/home/photo-repository.js';
import type { OriginalFile, PhotoStorage } from '../src/application/home/photo-storage.js';
import type { PlaceResolver } from '../src/application/home/place-resolver.js';
import type { Consent } from '../src/domain/account/consent.js';
import type { User } from '../src/domain/account/user.js';
import { InvalidImageError } from '../src/domain/home/errors.js';
import type { Home, HomeLocation } from '../src/domain/home/home.js';
import { firstFreePosition, type HomePhoto, MAX_PHOTOS } from '../src/domain/home/photo.js';

const DEFAULT_CREATED_AT = new Date('2026-10-01T09:00:00.000Z');

/** Usuario completo con valores por defecto; cada prueba cambia solo lo que le importa. */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    firebaseUid: 'uid-1',
    email: 'ana@example.com',
    displayName: 'Ana',
    phone: null,
    municipality: null,
    meetsVppRequirements: false,
    isOver65: false,
    assignedRole: null,
    createdAt: DEFAULT_CREATED_AT,
    ...overrides,
  };
}

/** Almacén en memoria de usuarios y consentimientos; reproduce la unicidad de uid y email. */
export class InMemoryUserRepository implements UserRepository, ConsentRepository {
  readonly users = new Map<string, User>();
  readonly consents: { userId: string; consent: Consent }[] = [];

  constructor(initial: readonly User[] = []) {
    for (const user of initial) this.users.set(user.id, user);
  }

  findByFirebaseUid(uid: string): Promise<User | null> {
    return Promise.resolve(
      [...this.users.values()].find((user) => user.firebaseUid === uid) ?? null,
    );
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  insertWithConsents(user: User, consents: readonly Consent[]): Promise<boolean> {
    const taken = [...this.users.values()].some(
      (other) =>
        other.firebaseUid === user.firebaseUid ||
        other.email.toLowerCase() === user.email.toLowerCase(),
    );
    if (taken) return Promise.resolve(false);
    this.users.set(user.id, user);
    for (const consent of consents) this.consents.push({ userId: user.id, consent });
    return Promise.resolve(true);
  }

  update(id: string, changes: ProfileChanges): Promise<User> {
    const current = this.users.get(id);
    if (!current) return Promise.reject(new Error(`Usuario inexistente: ${id}`));
    const updated = { ...current, ...changes };
    this.users.set(id, updated);
    return Promise.resolve(updated);
  }

  listByUser(userId: string): Promise<Consent[]> {
    return Promise.resolve(
      this.consents.filter((entry) => entry.userId === userId).map((entry) => entry.consent),
    );
  }

  add(userId: string, consent: Consent): Promise<Consent> {
    const existing = this.consents.find(
      (entry) =>
        entry.userId === userId &&
        entry.consent.type === consent.type &&
        entry.consent.version === consent.version,
    );
    if (existing) return Promise.resolve(existing.consent);
    this.consents.push({ userId, consent });
    return Promise.resolve(consent);
  }
}

/** Puerto de viviendas con un conjunto fijo de propietarios. */
export class FixedHomeOwnership implements HomeOwnership {
  constructor(readonly owners = new Set<string>()) {}

  hasPublishedHome(userId: string): Promise<boolean> {
    return Promise.resolve(this.owners.has(userId));
  }
}

/** Almacén en memoria de viviendas; conserva el orden de alta. */
export class InMemoryHomeRepository implements HomeRepository {
  readonly homes = new Map<string, Home>();

  insert(home: Home): Promise<void> {
    this.homes.set(home.id, home);
    return Promise.resolve();
  }

  save(home: Home): Promise<void> {
    if (!this.homes.has(home.id))
      return Promise.reject(new Error(`Vivienda inexistente: ${home.id}`));
    this.homes.set(home.id, home);
    return Promise.resolve();
  }

  findById(id: string): Promise<Home | null> {
    return Promise.resolve(this.homes.get(id) ?? null);
  }

  listByOwner(ownerId: string): Promise<Home[]> {
    return Promise.resolve([...this.homes.values()].filter((home) => home.ownerId === ownerId));
  }
}

/** Resolutor de direcciones de prueba para los casos de uso: el catálogo de lugares compartido con la app. */
export class CatalogPlaceResolver implements PlaceResolver {
  resolve(placeId: string): Promise<HomeLocation | null> {
    const place = FIXTURE_PLACES.find((candidate) => candidate.placeId === placeId);
    return Promise.resolve(
      place ? { exact: place.exact, areaName: place.areaName, areaCenter: place.areaCenter } : null,
    );
  }
}

/** Almacén en memoria de fotos; `markReady` reproduce la primera posición libre y el tope de 20. */
export class InMemoryPhotoRepository implements PhotoRepository {
  readonly photos = new Map<string, HomePhoto>();

  insertPending(photo: HomePhoto): Promise<void> {
    this.photos.set(photo.id, photo);
    return Promise.resolve();
  }

  find(homeId: string, photoId: string): Promise<HomePhoto | null> {
    const photo = this.photos.get(photoId);
    return Promise.resolve(photo?.homeId === homeId ? photo : null);
  }

  listReady(homeId: string): Promise<HomePhoto[]> {
    return this.listReadyByHomes([homeId]);
  }

  listReadyByHomes(homeIds: readonly string[]): Promise<HomePhoto[]> {
    const ready = [...this.photos.values()].filter(
      (photo) => photo.status === 'ready' && homeIds.includes(photo.homeId),
    );
    return Promise.resolve(ready.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
  }

  countReady(homeId: string): Promise<number> {
    return this.listReady(homeId).then((ready) => ready.length);
  }

  async markReady(homeId: string, photoId: string): Promise<HomePhoto | null> {
    const photo = await this.find(homeId, photoId);
    if (!photo) throw new Error(`Foto inexistente: ${photoId}`);
    const taken = (await this.listReady(homeId)).map((ready) => ready.position ?? 0);
    const position = taken.length >= MAX_PHOTOS ? null : firstFreePosition(taken);
    if (position === null) return null;
    const ready: HomePhoto = { ...photo, status: 'ready', position };
    this.photos.set(photoId, ready);
    return ready;
  }

  delete(homeId: string, photoId: string): Promise<void> {
    if (this.photos.get(photoId)?.homeId === homeId) this.photos.delete(photoId);
    return Promise.resolve();
  }
}

/** Almacenamiento de objetos en memoria con un espacio privado (originales) y otro público (procesadas). */
export class InMemoryPhotoStorage implements PhotoStorage {
  readonly originals = new Map<string, Buffer>();
  readonly published = new Map<string, { data: Buffer; contentType: string }>();
  readonly uploadUrls: { path: string; contentType: string; expiresAt: Date }[] = [];

  createUploadUrl(path: string, contentType: string, expiresAt: Date): Promise<string> {
    this.uploadUrls.push({ path, contentType, expiresAt });
    return Promise.resolve(`https://storage.test/upload/${path}`);
  }

  readOriginal(path: string, maxBytes: number): Promise<OriginalFile> {
    const data = this.originals.get(path);
    if (!data) return Promise.resolve({ status: 'missing' });
    return Promise.resolve(
      data.length > maxBytes ? { status: 'too_large' } : { status: 'found', data },
    );
  }

  publish(path: string, data: Buffer, contentType: string): Promise<void> {
    this.published.set(path, { data, contentType });
    return Promise.resolve();
  }

  deleteOriginal(path: string): Promise<void> {
    this.originals.delete(path);
    return Promise.resolve();
  }

  deletePublished(path: string): Promise<void> {
    this.published.delete(path);
    return Promise.resolve();
  }

  publicUrl(path: string): string {
    return `https://cdn.test/${path}`;
  }
}

/** Procesador de pruebas: solo da por buenos los ficheros que empiezan por `IMG:` y los devuelve marcados. */
export class StubImageProcessor implements ImageProcessor {
  readonly received: Buffer[] = [];

  process(original: Buffer): Promise<ProcessedImage> {
    this.received.push(original);
    if (!original.toString('utf8').startsWith('IMG:'))
      return Promise.reject(new InvalidImageError());
    return Promise.resolve({
      data: Buffer.from(`WEBP:${original.toString('utf8')}`),
      contentType: 'image/webp',
      width: 2048,
      height: 1536,
    });
  }
}
