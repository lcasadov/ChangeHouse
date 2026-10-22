import { describe, expect, it } from 'vitest';

import {
  HomeIncompleteError,
  HomeNotEditableError,
  HomeNotSubmittableError,
  InvalidValueRangeError,
} from './errors.js';
import {
  editHome,
  type Home,
  type HomeDetails,
  type HomeLocation,
  missingFields,
  newDraft,
  submitHome,
} from './home.js';

const NOW = new Date('2026-10-19T10:00:00.000Z');
const LATER = new Date('2026-10-20T10:00:00.000Z');
const LOCATION: HomeLocation = {
  exact: { lat: 40.4254, lng: -3.7058 },
  areaName: 'Malasaña',
  areaCenter: { lat: 40.4265, lng: -3.7038 },
};
const OTHER_LOCATION: HomeLocation = {
  exact: { lat: 40.4338, lng: -3.6978 },
  areaName: 'Chamberí',
  areaCenter: { lat: 40.434, lng: -3.7 },
};
const COMPLETE: HomeDetails = {
  usefulM2: 80,
  builtM2: 95,
  bedrooms: 3,
  bathrooms: 2,
  hasLift: true,
  garage: false,
  storageRoom: false,
  valueMinCents: 250_000_00,
  valueMaxCents: 280_000_00,
  isPrimaryResidence: true,
};

function draft(details: HomeDetails = {}): Home {
  return newDraft({
    id: 'home-1',
    ownerId: 'user-1',
    now: NOW,
    type: 'piso',
    address: 'Calle del Pez, 12, 28004 Madrid',
    location: LOCATION,
    details,
  });
}

const withStatus = (home: Home, status: Home['status']): Home => ({ ...home, status });

describe('newDraft', () => {
  it('Scenario: Alta de vivienda en borrador - nace en draft con los valores por defecto del contrato', () => {
    const home = draft();

    expect(home).toMatchObject({
      id: 'home-1',
      ownerId: 'user-1',
      status: 'draft',
      type: 'piso',
      regime: 'libre',
      address: 'Calle del Pez, 12, 28004 Madrid',
      location: LOCATION,
      locationVisibility: 'area',
      usefulM2: null,
      valueMinCents: null,
      hasLift: null,
      features: {},
      moderationNote: null,
      relevantChangedAt: null,
      createdAt: NOW,
    });
  });

  it('conserva los datos de los pasos ya rellenados', () => {
    const home = draft({ ...COMPLETE, regime: 'VPPB', locationVisibility: 'exact', floor: '3ª' });

    expect(home).toMatchObject({
      ...COMPLETE,
      regime: 'VPPB',
      locationVisibility: 'exact',
      floor: '3ª',
    });
  });

  it('Scenario: Rango de valor incoherente - rechaza un mínimo mayor que el máximo', () => {
    expect(() => draft({ valueMinCents: 300, valueMaxCents: 200 })).toThrow(InvalidValueRangeError);
  });
});

describe('editHome', () => {
  it('cambia solo lo indicado y no toca el estado de un borrador', () => {
    const edited = editHome(draft(COMPLETE), { bedrooms: 4, features: { terrace: true } }, LATER);

    expect(edited).toMatchObject({
      ...COMPLETE,
      bedrooms: 4,
      features: { terrace: true },
      status: 'draft',
    });
    expect(edited.relevantChangedAt).toBeNull();
  });

  it('cambiar la dirección sustituye también la ubicación resuelta', () => {
    const edited = editHome(
      draft(),
      { place: { address: 'Calle de Santa Engracia, 45', location: OTHER_LOCATION } },
      LATER,
    );

    expect(edited.address).toBe('Calle de Santa Engracia, 45');
    expect(edited.location).toEqual(OTHER_LOCATION);
  });

  it('Scenario: Rango de valor incoherente - rechaza un máximo por debajo del mínimo ya guardado', () => {
    const home = draft({ valueMinCents: 300, valueMaxCents: 400 });

    expect(() => editHome(home, { valueMaxCents: 200 }, LATER)).toThrow(InvalidValueRangeError);
  });

  it.each(['draft', 'in_review', 'published', 'paused'] as const)(
    'se puede editar en %s',
    (status) => {
      const edited = editHome(withStatus(draft(), status), { floor: '2ª' }, LATER);

      expect(edited.floor).toBe('2ª');
    },
  );

  it.each(['in_operation', 'closed'] as const)(
    'Scenario: Edición de una vivienda en operación - en %s el dominio lanza HomeNotEditableError',
    (status) => {
      expect(() => editHome(withStatus(draft(), status), { floor: '2ª' }, LATER)).toThrow(
        HomeNotEditableError,
      );
    },
  );

  it('una vivienda publicada que cambia un dato relevante vuelve a in_review y anota cuándo', () => {
    const published = withStatus(draft(COMPLETE), 'published');

    const edited = editHome(published, { usefulM2: 90 }, LATER);

    expect(edited.status).toBe('in_review');
    expect(edited.relevantChangedAt).toEqual(LATER);
  });

  it('una vivienda publicada que cambia su dirección vuelve a in_review', () => {
    const published = withStatus(draft(COMPLETE), 'published');

    const edited = editHome(
      published,
      { place: { address: 'Calle de Ibiza, 30', location: OTHER_LOCATION } },
      LATER,
    );

    expect(edited.status).toBe('in_review');
  });

  it('una vivienda publicada que cambia un dato no relevante sigue publicada', () => {
    const published = withStatus(draft(COMPLETE), 'published');

    const edited = editHome(
      published,
      { floor: '5ª', features: { terrace: true }, locationVisibility: 'exact' },
      LATER,
    );

    expect(edited.status).toBe('published');
    expect(edited.relevantChangedAt).toBeNull();
  });

  it('enviar el mismo valor que ya tiene no cuenta como cambio relevante', () => {
    const published = withStatus(draft(COMPLETE), 'published');

    const edited = editHome(published, { usefulM2: COMPLETE.usefulM2 }, LATER);

    expect(edited.status).toBe('published');
  });

  it('una vivienda pausada con un cambio relevante sigue pausada pero anota el cambio', () => {
    const paused = withStatus(draft(COMPLETE), 'paused');

    const edited = editHome(paused, { bedrooms: 5 }, LATER);

    expect(edited.status).toBe('paused');
    expect(edited.relevantChangedAt).toEqual(LATER);
  });

  it('no muta la vivienda original', () => {
    const home = draft(COMPLETE);

    editHome(home, { bedrooms: 9 }, LATER);

    expect(home.bedrooms).toBe(3);
  });
});

describe('missingFields y submitHome', () => {
  it('Scenario: Envío de una ficha incompleta - lista los campos que faltan', () => {
    expect(missingFields(draft())).toEqual([
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
    ]);
  });

  it('un cero o un falso son datos válidos: solo falta lo que es nulo', () => {
    const home = draft({ ...COMPLETE, bedrooms: 0, garage: false });

    expect(missingFields(home)).toEqual([]);
  });

  it('Scenario: Envío de una ficha incompleta - lanza HomeIncompleteError con los campos y sigue en draft', () => {
    const home = draft({ ...COMPLETE, valueMinCents: undefined, valueMaxCents: undefined });

    expect(() => submitHome(home)).toThrow(HomeIncompleteError);
    try {
      submitHome(home);
    } catch (error) {
      expect((error as HomeIncompleteError).fields).toEqual(['valueMinCents', 'valueMaxCents']);
    }
    expect(home.status).toBe('draft');
  });

  it('Scenario: Envío de una ficha completa - pasa de draft a in_review', () => {
    expect(submitHome(draft(COMPLETE)).status).toBe('in_review');
  });

  it.each(['in_review', 'published', 'paused', 'in_operation', 'closed'] as const)(
    'una vivienda en %s no se puede enviar',
    (status) => {
      expect(() => submitHome(withStatus(draft(COMPLETE), status))).toThrow(
        HomeNotSubmittableError,
      );
    },
  );
});
