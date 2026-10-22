import { describe, expect, it } from 'vitest';

import {
  InMemoryDiscoveryRepository,
  InMemoryHomeRepository,
  InMemoryPhotoRepository,
  InMemoryPhotoStorage,
  InMemorySearchPreferencesRepository,
  InMemoryUserRepository,
  makeUser,
} from '../../../test/fakes.js';
import { type Home, newDraft } from '../../domain/home/home.js';
import { newSearchPreferences } from '../../domain/search-preferences/search-preferences.js';
import { HomeNotFoundError } from '../home/errors.js';
import { decodeCursor } from '../moderation/cursor.js';
import { searchPreferencesOperations } from '../search-preferences/search-preferences-operations.js';
import { discoveryOperations } from './discovery-operations.js';
import type { DiscoveryCandidate, OwnerTerms } from './discovery-repository.js';
import { HomeIdRequiredError, SearchPreferencesRequiredError } from './errors.js';

const NOW = new Date('2026-10-19T10:00:00.000Z');
const ME = 'user-me';
const OTHER = 'user-other';
const MY_HOME = 'home-mine';
const EUR = 100;
const euros = (amount: number) => amount * EUR;

const GETAFE = {
  exact: { lat: 40.3056, lng: -3.7321 },
  areaName: 'Getafe Centro',
  areaCenter: { lat: 40.306, lng: -3.7325 },
  municipality: 'Getafe',
};
const COMPLETE = {
  usefulM2: 80,
  builtM2: 95,
  bedrooms: 3,
  bathrooms: 2,
  hasLift: true,
  garage: false,
  storageRoom: false,
  isPrimaryResidence: true,
};
/** Mis preferencias: busco en Leganés y pago hasta 30.000 €. */
const MY_PREFERENCES = {
  municipalities: ['Leganés'],
  maxToPayCents: euros(30_000),
  minToReceiveCents: 0,
  valueReferencePct: 50,
};
/** El otro dueño acepta recibir desde 0 € y pagar hasta 30.000 €. */
const OPEN_TERMS: OwnerTerms = {
  maxToPayCents: euros(30_000),
  minToReceiveCents: 0,
  valueReferencePct: 50,
};

/** Una vivienda completa con un valor fijo (mínimo = máximo) en euros. */
function homeWorth(id: string, ownerId: string, valueEuros: number, changes: Partial<Home> = {}) {
  const draft = newDraft({
    id,
    ownerId,
    now: NOW,
    type: 'piso',
    address: 'Calle Madrid, 8, Getafe',
    location: GETAFE,
    details: { ...COMPLETE, valueMinCents: euros(valueEuros), valueMaxCents: euros(valueEuros) },
  });
  return { ...draft, status: 'published' as const, publishedAt: NOW, ...changes };
}

/** Candidata publicada el día `day` de octubre, con el valor y los límites de su dueño. */
function candidate(
  id: string,
  valueEuros: number,
  day: number,
  ownerTerms: OwnerTerms | null = OPEN_TERMS,
): DiscoveryCandidate {
  const publishedAt = new Date(`2026-10-${String(day).padStart(2, '0')}T08:00:00.000Z`);
  return { home: homeWorth(id, OTHER, valueEuros), publishedAt, ownerTerms };
}

function setup() {
  const homes = new InMemoryHomeRepository();
  const users = new InMemoryUserRepository([makeUser({ id: ME }), makeUser({ id: OTHER })]);
  const preferences = new InMemorySearchPreferencesRepository();
  const candidates = new InMemoryDiscoveryRepository();
  const photos = new InMemoryPhotoRepository();
  const resolver = searchPreferencesOperations({ homes, preferences, ids: { next: () => 'p' } });
  const operations = discoveryOperations({
    homes,
    users,
    preferences,
    effectivePreferences: resolver.resolveEffectivePreferences,
    candidates,
    photos,
    storage: new InMemoryPhotoStorage(),
  });
  return { homes, users, preferences, candidates, photos, ...operations };
}

type Fixture = ReturnType<typeof setup>;

/** Mi vivienda publicada de 200.000 € con mis preferencias por defecto. */
async function asOwner(fixture: Fixture, valueEuros = 200_000): Promise<void> {
  fixture.homes.homes.set(MY_HOME, homeWorth(MY_HOME, ME, valueEuros));
  await fixture.preferences.upsert(
    { userId: ME, homeId: null },
    'pref-me',
    newSearchPreferences(MY_PREFERENCES),
  );
}

const ids = (page: { items: { id: string }[] }) => page.items.map((item) => item.id);

describe('discoverHomes desde una vivienda propia publicada', () => {
  it('Scenario: Compatibles en ambos sentidos - la candidata aceptable para los dos aparece con mi compensación', async () => {
    const fixture = setup();
    await asOwner(fixture);
    fixture.candidates.candidates.push(candidate('leganes', 220_000, 10));

    const page = await fixture.discoverHomes(ME, { homeId: MY_HOME, limit: 20 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: 'leganes',
      compensation: { kind: 'pay', amountCents: euros(20_000) },
    });
    expect(page.nextCursor).toBeNull();
    expect(fixture.candidates.queries[0]).toMatchObject({
      viewerId: ME,
      origin: { id: MY_HOME },
      preferences: { municipalities: ['Leganés'] },
    });
  });

  it('Scenario: Compensación fuera de mis límites - una candidata que vale 60.000 € más no aparece', async () => {
    const fixture = setup();
    await asOwner(fixture);
    fixture.candidates.candidates.push(candidate('cara', 260_000, 10));

    const page = await fixture.discoverHomes(ME, { homeId: MY_HOME, limit: 20 });

    expect(page.items).toEqual([]);
  });

  it('una candidata cuyo dueño exige recibir más de lo que yo pago no aparece', async () => {
    const fixture = setup();
    await asOwner(fixture);
    fixture.candidates.candidates.push(
      candidate('exigente', 220_000, 10, { ...OPEN_TERMS, minToReceiveCents: euros(25_000) }),
    );

    const page = await fixture.discoverHomes(ME, { homeId: MY_HOME, limit: 20 });

    expect(page.items).toEqual([]);
  });

  it('Scenario: El usuario paga - mi vivienda vale 200.000 € y la candidata 212.000 €: «Tú pagas 12.000 €»', async () => {
    const fixture = setup();
    await asOwner(fixture);
    fixture.candidates.candidates.push(candidate('candidata', 212_000, 10));

    const page = await fixture.discoverHomes(ME, { homeId: MY_HOME, limit: 20 });

    expect(page.items[0]?.compensation).toEqual({ kind: 'pay', amountCents: euros(12_000) });
  });

  it('si la mía vale más, la tarjeta dice cuánto recibo', async () => {
    const fixture = setup();
    await asOwner(fixture);
    fixture.candidates.candidates.push(candidate('barata', 185_000, 10));

    const page = await fixture.discoverHomes(ME, { homeId: MY_HOME, limit: 20 });

    expect(page.items[0]?.compensation).toEqual({ kind: 'receive', amountCents: euros(15_000) });
  });

  it('Scenario: Cambio justo - una diferencia de hasta el 1 % del mayor valor es «Cambio justo»', async () => {
    const fixture = setup();
    await asOwner(fixture);
    fixture.candidates.candidates.push(candidate('parecida', 202_000, 10));

    const page = await fixture.discoverHomes(ME, { homeId: MY_HOME, limit: 20 });

    expect(page.items[0]?.compensation).toEqual({ kind: 'fair', amountCents: euros(2_000) });
  });

  it('cada lado valora su vivienda con el punto de referencia de su dueño', async () => {
    const fixture = setup();
    await asOwner(fixture);
    const ranged = candidate('rango', 210_000, 10, { ...OPEN_TERMS, valueReferencePct: 0 });
    fixture.candidates.candidates.push({
      ...ranged,
      home: { ...ranged.home, valueMinCents: euros(210_000), valueMaxCents: euros(300_000) },
    });

    const page = await fixture.discoverHomes(ME, { homeId: MY_HOME, limit: 20 });

    expect(page.items[0]?.compensation).toEqual({ kind: 'pay', amountCents: euros(10_000) });
  });

  it('una candidata sin condiciones de su dueño o sin rango de valor no es compatible', async () => {
    const fixture = setup();
    await asOwner(fixture);
    const unvalued = candidate('sin-valor', 200_000, 11);
    fixture.candidates.candidates.push(candidate('sin-condiciones', 200_000, 10, null), {
      ...unvalued,
      home: { ...unvalued.home, valueMaxCents: null },
    });

    const page = await fixture.discoverHomes(ME, { homeId: MY_HOME, limit: 20 });

    expect(page.items).toEqual([]);
  });

  it('usa las preferencias propias de la vivienda si las tiene', async () => {
    const fixture = setup();
    await asOwner(fixture);
    await fixture.preferences.upsert(
      { userId: ME, homeId: MY_HOME },
      'pref-home',
      newSearchPreferences({ ...MY_PREFERENCES, municipalities: ['Valencia'] }),
    );

    await fixture.discoverHomes(ME, { homeId: MY_HOME, limit: 20 });

    expect(fixture.candidates.queries[0]?.preferences.municipalities).toEqual(['Valencia']);
  });

  it('la tarjeta es la forma pública de la vivienda con sus fotos listas, sin dirección ni dueño', async () => {
    const fixture = setup();
    await asOwner(fixture);
    fixture.candidates.candidates.push(candidate('leganes', 220_000, 10));
    fixture.photos.photos.set('foto-1', {
      id: 'foto-1',
      homeId: 'leganes',
      status: 'ready',
      storagePath: 'homes/leganes/foto-1.webp',
      position: 1,
      createdAt: NOW,
    });

    const page = await fixture.discoverHomes(ME, { homeId: MY_HOME, limit: 20 });

    const card = page.items[0];
    expect(card?.photos).toEqual([
      { id: 'foto-1', url: 'https://cdn.test/homes/leganes/foto-1.webp', position: 1 },
    ]);
    expect(card?.location).toEqual({
      visibility: 'area',
      point: GETAFE.areaCenter,
      areaName: GETAFE.areaName,
    });
    expect(card).not.toHaveProperty('address');
    expect(card).not.toHaveProperty('ownerId');
    expect(card).not.toHaveProperty('status');
  });
});

describe('paginación', () => {
  it('Scenario: Paginación - con más compatibles que el tamaño de página, el cursor da las siguientes sin repetir ninguna', async () => {
    const fixture = setup();
    await asOwner(fixture);
    for (let day = 1; day <= 5; day += 1) {
      fixture.candidates.candidates.push(candidate(`compatible-${String(day)}`, 210_000, day));
      fixture.candidates.candidates.push(candidate(`cara-${String(day)}`, 290_000, day));
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const after = cursor === null ? undefined : (decodeCursor(cursor) ?? undefined);
      const page = await fixture.discoverHomes(ME, { homeId: MY_HOME, after, limit: 2 });
      seen.push(...ids(page));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor !== null && pages < 10);

    expect(seen).toEqual([
      'compatible-5',
      'compatible-4',
      'compatible-3',
      'compatible-2',
      'compatible-1',
    ]);
    expect(pages).toBe(3);
  });

  it('la última página completa no devuelve cursor si no queda ninguna compatible', async () => {
    const fixture = setup();
    await asOwner(fixture);
    fixture.candidates.candidates.push(
      candidate('a', 210_000, 2),
      candidate('b', 210_000, 1),
      candidate('cara', 290_000, 3),
    );

    const page = await fixture.discoverHomes(ME, { homeId: MY_HOME, limit: 2 });

    expect(ids(page)).toEqual(['a', 'b']);
    expect(page.nextCursor).toBeNull();
  });

  it('repite la fase 1 cuando la economía descarta candidatas, hasta llenar la página', async () => {
    const fixture = setup();
    await asOwner(fixture);
    for (let day = 10; day <= 28; day += 1) {
      fixture.candidates.candidates.push(candidate(`cara-${String(day)}`, 290_000, day));
    }
    fixture.candidates.candidates.push(
      candidate('vieja-1', 210_000, 2),
      candidate('vieja-2', 210_000, 1),
    );

    const page = await fixture.discoverHomes(ME, { homeId: MY_HOME, limit: 2 });

    expect(ids(page)).toEqual(['vieja-1', 'vieja-2']);
    expect(fixture.candidates.queries.length).toBeGreaterThan(1);
    expect(fixture.candidates.queries[0]?.limit).toBeGreaterThan(2);
  });

  it('con un presupuesto de exploración agotado devuelve lo encontrado y un cursor para seguir', async () => {
    const fixture = setup();
    await asOwner(fixture);
    for (let index = 0; index < 200; index += 1) {
      const at = new Date(Date.UTC(2026, 8, 1, 0, index));
      fixture.candidates.candidates.push({
        ...candidate(`cara-${String(index).padStart(3, '0')}`, 290_000, 1),
        publishedAt: at,
      });
    }
    fixture.candidates.candidates.push({
      ...candidate('al-fondo', 210_000, 1),
      publishedAt: new Date(Date.UTC(2026, 7, 1)),
    });

    const first = await fixture.discoverHomes(ME, { homeId: MY_HOME, limit: 2 });

    expect(first.items).toEqual([]);
    expect(first.nextCursor).not.toBeNull();
    const found: string[] = [];
    let cursor = first.nextCursor;
    for (let round = 0; round < 50 && cursor !== null; round += 1) {
      const page = await fixture.discoverHomes(ME, {
        homeId: MY_HOME,
        after: decodeCursor(cursor) ?? undefined,
        limit: 2,
      });
      found.push(...ids(page));
      cursor = page.nextCursor;
    }
    expect(found).toEqual(['al-fondo']);
    expect(cursor).toBeNull();
  });

  it('el cursor recibido se pasa a la fase 1 como posición de partida', async () => {
    const fixture = setup();
    await asOwner(fixture);
    const after = { at: new Date('2026-10-05T00:00:00.000Z'), id: 'x' };

    await fixture.discoverHomes(ME, { homeId: MY_HOME, after, limit: 20 });

    expect(fixture.candidates.queries[0]?.after).toEqual(after);
  });
});

describe('vivienda desde la que se busca', () => {
  it('un owner con una sola vivienda publicada puede omitir homeId', async () => {
    const fixture = setup();
    await asOwner(fixture);
    fixture.homes.homes.set('borrador', { ...homeWorth('borrador', ME, 1), status: 'draft' });
    fixture.candidates.candidates.push(candidate('leganes', 220_000, 10));

    const page = await fixture.discoverHomes(ME, { limit: 20 });

    expect(page.items[0]?.compensation).toEqual({ kind: 'pay', amountCents: euros(20_000) });
    expect(fixture.candidates.queries[0]?.origin?.id).toBe(MY_HOME);
  });

  it('un owner con varias viviendas publicadas debe indicar homeId (400)', async () => {
    const fixture = setup();
    await asOwner(fixture);
    fixture.homes.homes.set('segunda', homeWorth('segunda', ME, 300_000));

    await expect(fixture.discoverHomes(ME, { limit: 20 })).rejects.toBeInstanceOf(
      HomeIdRequiredError,
    );
    await expect(fixture.discoverHomes(ME, { limit: 20 })).rejects.toMatchObject({
      kind: 'invalid_request',
      fields: ['homeId'],
    });
    expect(fixture.candidates.queries).toHaveLength(0);
  });

  it.each([
    ['ajena', 'ajena', { ownerId: OTHER }],
    ['propia no publicada', 'pausada', { status: 'paused' as const }],
  ])('una vivienda %s es un 404 y no se consulta nada', async (_label, id, changes) => {
    const fixture = setup();
    await asOwner(fixture);
    fixture.homes.homes.set(id, homeWorth(id, ME, 200_000, changes));

    await expect(fixture.discoverHomes(ME, { homeId: id, limit: 20 })).rejects.toBeInstanceOf(
      HomeNotFoundError,
    );
    expect(fixture.candidates.queries).toHaveLength(0);
  });

  it('una vivienda inexistente es el mismo 404', async () => {
    const fixture = setup();

    await expect(
      fixture.discoverHomes(ME, { homeId: 'no-existe', limit: 20 }),
    ).rejects.toBeInstanceOf(HomeNotFoundError);
  });

  it('sin preferencias efectivas para la vivienda es un 422', async () => {
    const fixture = setup();
    fixture.homes.homes.set(MY_HOME, homeWorth(MY_HOME, ME, 200_000));

    await expect(fixture.discoverHomes(ME, { homeId: MY_HOME, limit: 20 })).rejects.toMatchObject({
      code: 'SEARCH_PREFERENCES_REQUIRED',
      kind: 'rule',
    });
  });
});

describe('modo seeker (sin vivienda publicada)', () => {
  it('Scenario: Buscador mirando - ve las viviendas de sus preferencias por defecto sin compensación', async () => {
    const fixture = setup();
    fixture.homes.homes.set('borrador', { ...homeWorth('borrador', ME, 1), status: 'draft' });
    await fixture.preferences.upsert(
      { userId: ME, homeId: null },
      'pref-me',
      newSearchPreferences({ ...MY_PREFERENCES, municipalities: ['Madrid'] }),
    );
    fixture.candidates.candidates.push(
      candidate('madrid-1', 900_000, 10, null),
      candidate('madrid-2', 150_000, 9),
    );

    const page = await fixture.discoverHomes(ME, { limit: 20 });

    expect(page.items.map((item) => [item.id, item.compensation])).toEqual([
      ['madrid-1', null],
      ['madrid-2', null],
    ]);
    expect(fixture.candidates.queries[0]).toMatchObject({
      origin: null,
      preferences: { municipalities: ['Madrid'] },
    });
  });

  it('GIVEN un seeker WHEN consulta sin homeId THEN las tarjetas no incluyen compensación y pagina igual', async () => {
    const fixture = setup();
    await fixture.preferences.upsert(
      { userId: ME, homeId: null },
      'pref-me',
      newSearchPreferences(MY_PREFERENCES),
    );
    fixture.candidates.candidates.push(
      candidate('a', 1, 3),
      candidate('b', 1, 2),
      candidate('c', 1, 1),
    );

    const first = await fixture.discoverHomes(ME, { limit: 2 });
    const second = await fixture.discoverHomes(ME, {
      after: decodeCursor(first.nextCursor ?? '') ?? undefined,
      limit: 2,
    });

    expect(ids(first)).toEqual(['a', 'b']);
    expect(ids(second)).toEqual(['c']);
    expect(second.nextCursor).toBeNull();
    expect([...first.items, ...second.items].every((item) => item.compensation === null)).toBe(
      true,
    );
  });

  it('sin preferencias por defecto es un 422', async () => {
    const fixture = setup();

    await expect(fixture.discoverHomes(ME, { limit: 20 })).rejects.toBeInstanceOf(
      SearchPreferencesRequiredError,
    );
  });
});

describe('VPP (RN-06)', () => {
  it.each([
    [true, true],
    [false, false],
  ])(
    'Scenario: VPP sin requisitos - con meetsVppRequirements = %s la fase 1 incluye VPP: %s',
    async (meets, included) => {
      const fixture = setup();
      await asOwner(fixture);
      await fixture.users.update(ME, { meetsVppRequirements: meets });

      await fixture.discoverHomes(ME, { homeId: MY_HOME, limit: 20 });

      expect(fixture.candidates.queries[0]?.includeVpp).toBe(included);
    },
  );

  it('un usuario que no se encuentra no ve VPP', async () => {
    const fixture = setup();
    await fixture.preferences.upsert(
      { userId: 'fantasma', homeId: null },
      'pref-x',
      newSearchPreferences(MY_PREFERENCES),
    );

    await fixture.discoverHomes('fantasma', { limit: 20 });

    expect(fixture.candidates.queries[0]?.includeVpp).toBe(false);
  });
});
