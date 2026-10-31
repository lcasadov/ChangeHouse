import { describe, expect, it } from 'vitest';

import {
  InMemoryAccountExportReader,
  InMemoryHomeRepository,
  InMemoryPhotoRepository,
  InMemoryPhotoStorage,
  InMemorySearchPreferencesRepository,
  InMemoryUserRepository,
  makeUser,
} from '../../../test/fakes.js';
import { newDraft } from '../../domain/home/home.js';
import { exportMyData } from './account-export.js';
import { AccountNotFoundError } from './errors.js';

const NOW = new Date('2026-10-30T10:00:00.000Z');
const AT = new Date('2026-10-20T09:00:00.000Z');

async function setup() {
  const users = new InMemoryUserRepository([
    makeUser({
      id: 'u1',
      email: 'ana@example.com',
      displayName: 'Ana',
      phone: '+34600111222',
      municipality: 'Getafe',
    }),
  ]);
  await users.add('u1', { type: 'terms', version: '2026-10', acceptedAt: AT });
  const homes = new InMemoryHomeRepository();
  await homes.insert(
    newDraft({
      id: 'h1',
      ownerId: 'u1',
      now: AT,
      type: 'piso',
      address: 'Calle Mayor, 1, Getafe',
      location: {
        exact: { lat: 40.3, lng: -3.7 },
        areaName: 'Getafe Centro',
        areaCenter: { lat: 40.31, lng: -3.71 },
      },
      details: {},
    }),
  );
  const photos = new InMemoryPhotoRepository();
  await photos.insertPending({
    id: 'p1',
    homeId: 'h1',
    status: 'ready',
    storagePath: 'homes/h1/p1.webp',
    position: 1,
    createdAt: AT,
  });
  const preferences = new InMemorySearchPreferencesRepository();
  const reader = new InMemoryAccountExportReader();
  return {
    users,
    homes,
    preferences,
    reader,
    run: (userId = 'u1') =>
      exportMyData(
        {
          users,
          consents: users,
          homes,
          photos,
          storage: new InMemoryPhotoStorage(),
          preferences,
          reader,
          clock: { now: () => NOW },
        },
        userId,
      ),
  };
}

describe('exportMyData', () => {
  it('Scenario: Exportación - incluye la cuenta con sus datos personales y la fecha de exportación', async () => {
    const { run } = await setup();

    const data = await run();

    expect(data.exportedAt).toBe('2026-10-30T10:00:00.000Z');
    expect(data.account).toEqual({
      id: 'u1',
      email: 'ana@example.com',
      displayName: 'Ana',
      phone: '+34600111222',
      municipality: 'Getafe',
      meetsVppRequirements: false,
      isOver65: false,
      createdAt: '2026-10-01T09:00:00.000Z',
    });
  });

  it('incluye sus viviendas con su propia dirección y sus fotos', async () => {
    const { run } = await setup();

    const data = await run();

    expect(data.homes).toHaveLength(1);
    expect(data.homes[0]).toMatchObject({
      id: 'h1',
      address: 'Calle Mayor, 1, Getafe',
      status: 'draft',
      photos: [{ id: 'p1', url: 'https://cdn.test/homes/h1/p1.webp', position: 1 }],
    });
  });

  it('incluye las preferencias por defecto y las de cada vivienda, o nulas si no hay', async () => {
    const { run, preferences } = await setup();
    const empty = await run();
    const stored = {
      center: null,
      radiusKm: null,
      municipalities: ['Leganés'],
      filters: {},
      maxToPayCents: 100,
      minToReceiveCents: 0,
      valueReferencePct: 50,
    };
    await preferences.upsert({ userId: 'u1', homeId: null }, 'pref-1', stored);
    await preferences.upsert({ userId: 'u1', homeId: 'h1' }, 'pref-2', stored);

    const data = await run();

    expect(empty.searchPreferences).toEqual({ default: null, byHome: [] });
    expect(data.searchPreferences.default).toMatchObject({ municipalities: ['Leganés'] });
    expect(data.searchPreferences.byHome).toEqual([
      expect.objectContaining({ homeId: 'h1', municipalities: ['Leganés'] }),
    ]);
  });

  it('incluye los consentimientos con versión y fecha', async () => {
    const { run } = await setup();

    const data = await run();

    expect(data.consents).toEqual([
      { type: 'terms', version: '2026-10', acceptedAt: '2026-10-20T09:00:00.000Z' },
    ]);
  });

  it('serializa me gusta, descartes y matches con fechas ISO y solo ids de las otras viviendas', async () => {
    const { run, reader } = await setup();
    reader.likes = [{ fromHomeId: 'h1', toHomeId: 'h2', createdAt: AT }];
    reader.dismissals = [
      { homeId: 'h1', dismissedHomeId: 'h3', createdAt: AT },
      { homeId: null, dismissedHomeId: 'h4', createdAt: AT },
    ];
    reader.matches = [
      {
        id: 'm1',
        type: 2,
        status: 'open',
        createdAt: AT,
        participation: [
          {
            homeId: 'h1',
            givesHomeId: 'h1',
            receivesHomeId: 'h2',
            compensationCents: 100,
            status: 'pending',
            sharesPhone: false,
          },
        ],
        otherHomeIds: ['h2'],
      },
    ];

    const data = await run();

    expect(reader.requestedFor).toEqual(['u1']);
    expect(data.likes).toEqual([
      { fromHomeId: 'h1', toHomeId: 'h2', createdAt: '2026-10-20T09:00:00.000Z' },
    ]);
    expect(data.dismissals).toEqual([
      { homeId: 'h1', dismissedHomeId: 'h3', createdAt: '2026-10-20T09:00:00.000Z' },
      { homeId: null, dismissedHomeId: 'h4', createdAt: '2026-10-20T09:00:00.000Z' },
    ]);
    expect(data.matches).toEqual([
      {
        id: 'm1',
        type: 2,
        status: 'open',
        createdAt: '2026-10-20T09:00:00.000Z',
        participation: reader.matches[0]?.participation,
        otherHomeIds: ['h2'],
      },
    ]);
  });

  it('una cuenta inexistente o ya eliminada no se exporta', async () => {
    const { run, users } = await setup();
    users.users.set('u2', makeUser({ id: 'u2', deletedAt: NOW }));

    await expect(run('nadie')).rejects.toBeInstanceOf(AccountNotFoundError);
    await expect(run('u2')).rejects.toBeInstanceOf(AccountNotFoundError);
  });
});
