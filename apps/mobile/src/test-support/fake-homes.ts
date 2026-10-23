import { FIXTURE_PLACES, type HomeInput } from '@changehouse/shared';

import type { Home } from '../features/homes/homes-api';
import { json, problem } from './http-responses';

/** Campos que la API exige para enviar a revisión (`submitHome`). */
const REQUIRED_TO_SUBMIT = [
  'usefulM2',
  'builtM2',
  'bedrooms',
  'bathrooms',
  'hasLift',
  'garage',
  'storageRoom',
  'valueMinCents',
  'valueMaxCents',
  'isPrimaryResidence',
] as const;

const NOT_EDITABLE = new Set<Home['status']>(['in_operation', 'closed']);
const HOME_PATH = /^\/homes\/([^/]+)(?:\/(submit|photos)(?:\/([^/]+?)(\/complete)?)?)?$/;

const MAX_PHOTOS = 20;
const MIN_PHOTOS = 3;
const PHOTO_BASE_URL = 'https://cdn.changehouse.test/photos';
const UPLOAD_BASE_URL = 'https://storage.changehouse.test/upload';

const MALASANA = FIXTURE_PLACES[0];

let sequence = 0;

/** Fotos ya procesadas, en orden: la primera es la portada. */
export function readyPhotos(count: number): NonNullable<Home['photos']> {
  return Array.from({ length: count }, (_, index) => ({
    id: `0198f3a0-1111-7000-8000-${String(index + 1).padStart(12, '0')}`,
    url: `${PHOTO_BASE_URL}/${String(index + 1)}.webp`,
    position: index + 1,
  }));
}

interface PendingPhoto {
  homeId: string;
  photoId: string;
  /** El fichero llegó al almacenamiento; `null` mientras no se haya subido. */
  uploaded: { valid: boolean } | null;
}

/** Un borrador recién creado con el primer paso hecho; el resto, sin rellenar. */
export function draftHome(overrides: Partial<Home> = {}): Home {
  sequence += 1;
  return {
    id: `0198f3a0-0000-7000-8000-${String(sequence).padStart(12, '0')}`,
    status: 'draft',
    type: 'piso',
    regime: 'libre',
    address: MALASANA?.formatted ?? '',
    usefulM2: null,
    builtM2: null,
    bedrooms: null,
    bathrooms: null,
    floor: null,
    hasLift: null,
    garage: null,
    storageRoom: null,
    features: {},
    energyRating: null,
    yearBuilt: null,
    valueMinCents: null,
    valueMaxCents: null,
    isPrimaryResidence: null,
    mortgageOutstandingCents: null,
    vppQualificationDate: null,
    vppProtectionEnd: null,
    vppMaxLegalPriceCents: null,
    location: {
      visibility: 'area',
      point: MALASANA?.areaCenter ?? { lat: 0, lng: 0 },
      areaName: MALASANA?.areaName ?? '',
    },
    photos: [],
    createdAt: '2026-10-19T10:00:00.000Z',
    ...overrides,
  };
}

/** Una ficha con todos los datos obligatorios y 3 fotos, en el estado indicado. */
export function completeHome(overrides: Partial<Home> = {}): Home {
  return draftHome({
    usefulM2: 80,
    builtM2: 95,
    bedrooms: 3,
    bathrooms: 2,
    hasLift: true,
    garage: false,
    storageRoom: true,
    valueMinCents: 25_000_000,
    valueMaxCents: 30_000_000,
    isPrimaryResidence: true,
    photos: readyPhotos(MIN_PHOTOS),
    ...overrides,
  });
}

const isMissing = (value: unknown) => value === null || value === undefined;

/**
 * Las viviendas del usuario con las reglas de la API (`docs/api/openapi.yaml`): dirección resuelta
 * contra los lugares de prueba, rango de valor, edición según estado y completitud al enviar.
 */
export class FakeHomes {
  private readonly homes: Home[];
  private readonly pending: PendingPhoto[] = [];
  private photoSequence = 0;
  private listFailure: { status: number; remaining: number } | null = null;

  constructor(seed: readonly Home[]) {
    this.homes = [...seed];
  }

  all(): readonly Home[] {
    return this.homes;
  }

  /** Las siguientes `times` lecturas del listado (`GET /me/homes`) responden con este error. */
  rejectNextList(status: number, times = 1): void {
    this.listFailure = { status, remaining: times };
  }

  respond(method: string, path: string, body: unknown): Response {
    if (path === '/me/homes') {
      const failure = this.listFailure;
      if (failure === null) return json(200, this.homes);
      failure.remaining -= 1;
      if (failure.remaining === 0) this.listFailure = null;
      return problem(failure.status);
    }
    if (path === '/homes') return this.create(body as HomeInput);

    const match = HOME_PATH.exec(path);
    const home = this.homes.find((candidate) => candidate.id === match?.[1]);
    if (!match || !home) return problem(404);
    if (match[2] === 'submit') return this.submit(home);
    if (match[2] === 'photos') return this.photos(method, home, match[3], match[4] !== undefined);
    return method === 'PATCH'
      ? this.update(home, body as Partial<Home> & Partial<HomeInput>)
      : json(200, home);
  }

  /**
   * El almacenamiento recibió el fichero de una subida firmada (lo llama el doble del subidor).
   * `valid` es `false` si no es una imagen.
   */
  receiveUpload(uploadUrl: string, valid: boolean): void {
    const photoId = uploadUrl.slice(UPLOAD_BASE_URL.length + 1);
    const pending = this.pending.find((candidate) => candidate.photoId === photoId);
    if (pending) pending.uploaded = { valid };
  }

  private photos(method: string, home: Home, photoId: string | undefined, complete: boolean) {
    if (NOT_EDITABLE.has(home.status)) return problem(409, { code: 'HOME_NOT_EDITABLE' });
    if (photoId === undefined) return this.createUpload(home);
    if (method === 'DELETE') return this.deletePhoto(home, photoId);
    return complete ? this.completeUpload(home, photoId) : problem(404);
  }

  private createUpload(home: Home): Response {
    if ((home.photos?.length ?? 0) >= MAX_PHOTOS) {
      return problem(409, { code: 'PHOTO_LIMIT_REACHED' });
    }
    this.photoSequence += 1;
    const photoId = `0198f3a0-2222-7000-8000-${String(this.photoSequence).padStart(12, '0')}`;
    this.pending.push({ homeId: home.id, photoId, uploaded: null });
    return json(201, {
      photoId,
      uploadUrl: `${UPLOAD_BASE_URL}/${photoId}`,
      expiresAt: '2026-10-19T10:15:00.000Z',
    });
  }

  private completeUpload(home: Home, photoId: string): Response {
    const ready = home.photos?.find((photo) => photo.id === photoId);
    if (ready) return json(200, ready);
    const pending = this.pending.find(
      (candidate) => candidate.photoId === photoId && candidate.homeId === home.id,
    );
    if (!pending) return problem(404);
    if (!pending.uploaded) return problem(422, { code: 'PHOTO_NOT_UPLOADED' });
    this.pending.splice(this.pending.indexOf(pending), 1);
    if (!pending.uploaded.valid) return problem(422, { code: 'INVALID_IMAGE' });
    const photos = home.photos ?? [];
    if (photos.length >= MAX_PHOTOS) return problem(409, { code: 'PHOTO_LIMIT_REACHED' });
    const photo = {
      id: photoId,
      url: `${PHOTO_BASE_URL}/${photoId}.webp`,
      position: photos.length + 1,
    };
    home.photos = [...photos, photo];
    return json(200, photo);
  }

  private deletePhoto(home: Home, photoId: string): Response {
    const photos = home.photos ?? [];
    const pendingIndex = this.pending.findIndex((candidate) => candidate.photoId === photoId);
    if (!photos.some((photo) => photo.id === photoId)) {
      if (pendingIndex < 0) return problem(404);
      this.pending.splice(pendingIndex, 1);
      return new Response(null, { status: 204 });
    }
    if (home.status === 'published' && photos.length <= MIN_PHOTOS) {
      return problem(409, { code: 'HOME_MIN_PHOTOS' });
    }
    home.photos = photos
      .filter((photo) => photo.id !== photoId)
      .map((photo, index) => ({ ...photo, position: index + 1 }));
    return new Response(null, { status: 204 });
  }

  private create(input: HomeInput): Response {
    const place = FIXTURE_PLACES.find((candidate) => candidate.placeId === input.address.placeId);
    if (!place) return this.addressNotResolved();
    const home = draftHome({
      type: input.type,
      address: place.formatted,
      location: { visibility: 'area', point: place.areaCenter, areaName: place.areaName },
    });
    this.homes.push(home);
    return json(201, home);
  }

  private update(home: Home, patch: Partial<Home> & Partial<HomeInput>): Response {
    if (NOT_EDITABLE.has(home.status)) return problem(409, { code: 'HOME_NOT_EDITABLE' });
    const { address, locationVisibility, ...rest } = patch;
    const min = rest.valueMinCents ?? home.valueMinCents;
    const max = rest.valueMaxCents ?? home.valueMaxCents;
    const invalidRange =
      (!isMissing(min) && min <= 0) ||
      (!isMissing(max) && max <= 0) ||
      (min ?? 0) > (max ?? Infinity);
    if (invalidRange) {
      return problem(422, {
        code: 'INVALID_VALUE_RANGE',
        errors: [
          { field: 'valueMinCents', message: 'required' },
          { field: 'valueMaxCents', message: 'required' },
        ],
      });
    }

    let location = home.location;
    let formatted = home.address;
    if (address) {
      const place = FIXTURE_PLACES.find((candidate) => candidate.placeId === address.placeId);
      if (!place) return this.addressNotResolved();
      formatted = place.formatted;
      location = { ...location, point: place.areaCenter, areaName: place.areaName };
    }
    if (locationVisibility) location = { ...location, visibility: locationVisibility };

    Object.assign(home, rest, { address: formatted, location });
    return json(200, home);
  }

  private submit(home: Home): Response {
    if (home.status !== 'draft') return problem(409);
    const missing: string[] = REQUIRED_TO_SUBMIT.filter((field) => isMissing(home[field]));
    if ((home.photos?.length ?? 0) < MIN_PHOTOS) missing.push('photos');
    if (missing.length > 0) {
      return problem(422, {
        code: 'HOME_INCOMPLETE',
        errors: missing.map((field) => ({ field, message: 'required' })),
      });
    }
    home.status = 'in_review';
    return json(200, home);
  }

  private addressNotResolved(): Response {
    return problem(422, {
      code: 'ADDRESS_NOT_RESOLVED',
      errors: [{ field: 'address', message: 'required' }],
    });
  }
}
