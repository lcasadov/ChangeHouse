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
const HOME_PATH = /^\/homes\/([^/]+)(\/submit)?$/;

const MALASANA = FIXTURE_PLACES[0];

let sequence = 0;

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

/** Una ficha con todos los datos obligatorios, en el estado indicado. */
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

  constructor(seed: readonly Home[]) {
    this.homes = [...seed];
  }

  all(): readonly Home[] {
    return this.homes;
  }

  respond(method: string, path: string, body: unknown): Response {
    if (path === '/me/homes') return json(200, this.homes);
    if (path === '/homes') return this.create(body as HomeInput);

    const match = HOME_PATH.exec(path);
    const home = this.homes.find((candidate) => candidate.id === match?.[1]);
    if (!match || !home) return problem(404);
    if (match[2]) return this.submit(home);
    return method === 'PATCH'
      ? this.update(home, body as Partial<Home> & Partial<HomeInput>)
      : json(200, home);
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
    const missing = REQUIRED_TO_SUBMIT.filter((field) => isMissing(home[field]));
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
