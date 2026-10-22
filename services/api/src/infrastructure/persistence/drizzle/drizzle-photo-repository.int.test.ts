import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { makeUser } from '../../../../test/fakes.js';
import { openSql } from '../../../../test/fixtures.js';
import { newDraft } from '../../../domain/home/home.js';
import type { HomePhoto } from '../../../domain/home/photo.js';
import { AddressCipher } from '../../crypto/address-cipher.js';
import { createDatabase, type DatabaseConnection } from './database.js';
import { DrizzleHomeRepository } from './drizzle-home-repository.js';
import { DrizzlePhotoRepository } from './drizzle-photo-repository.js';
import { DrizzleUserRepository } from './drizzle-user-repository.js';

const sql = openSql();
const NOW = new Date('2026-10-19T10:00:00.000Z');
const OWNER = '0199c1a2-0000-7000-8000-0000000000b1';
const HOME_A = '0199c1a2-0000-7000-8000-000000000201';
const HOME_B = '0199c1a2-0000-7000-8000-000000000202';
const LOCATION = {
  exact: { lat: 40.4254, lng: -3.7058 },
  areaName: 'Malasaña',
  areaCenter: { lat: 40.4265, lng: -3.7038 },
};

let connection: DatabaseConnection;
let photos: DrizzlePhotoRepository;

const photoId = (n: number) => `0199c1a2-0000-7000-8000-0000000003${String(n).padStart(2, '0')}`;

function pending(n: number, homeId = HOME_A): HomePhoto {
  return {
    id: photoId(n),
    homeId,
    status: 'pending',
    storagePath: `homes/${homeId}/${photoId(n)}.webp`,
    position: null,
    createdAt: new Date(NOW.getTime() + n),
  };
}

async function ready(n: number, homeId = HOME_A): Promise<HomePhoto> {
  await photos.insertPending(pending(n, homeId));
  const result = await photos.markReady(homeId, photoId(n));
  if (!result) throw new Error('no hay hueco');
  return result;
}

beforeAll(async () => {
  connection = createDatabase(inject('databaseUrl'));
  photos = new DrizzlePhotoRepository(connection.db);
  await sql`TRUNCATE users CASCADE`;
  await new DrizzleUserRepository(connection.db).insertWithConsents(
    makeUser({ id: OWNER, firebaseUid: 'uid-photos', email: 'photos@example.com' }),
    [],
  );
  const homes = new DrizzleHomeRepository(
    connection.db,
    new AddressCipher(new Map([[1, randomBytes(32)]]), 1),
  );
  for (const id of [HOME_A, HOME_B]) {
    await homes.insert(
      newDraft({
        id,
        ownerId: OWNER,
        now: NOW,
        type: 'piso',
        address: 'Calle del Pez, 12',
        location: LOCATION,
      }),
    );
  }
});

beforeEach(async () => {
  await sql`TRUNCATE home_photos`;
});

afterAll(async () => {
  await connection.close();
  await sql.end();
});

describe('DrizzlePhotoRepository', () => {
  it('guarda una foto pendiente sin posición y la encuentra solo en su vivienda', async () => {
    await photos.insertPending(pending(1));

    await expect(photos.find(HOME_A, photoId(1))).resolves.toEqual(pending(1));
    await expect(photos.find(HOME_B, photoId(1))).resolves.toBeNull();
    await expect(photos.find(HOME_A, photoId(9))).resolves.toBeNull();
  });

  it('Scenario: Subida sin confirmar - una foto pendiente no se lista ni cuenta como lista', async () => {
    await photos.insertPending(pending(1));

    await expect(photos.listReady(HOME_A)).resolves.toEqual([]);
    await expect(photos.countReady(HOME_A)).resolves.toBe(0);
  });

  it('markReady pasa la foto a ready en la primera posición libre, rellenando los huecos', async () => {
    const first = await ready(1);
    const second = await ready(2);
    await ready(3);
    await photos.delete(HOME_A, second.id);

    const refilled = await ready(4);

    expect([first.position, second.position, refilled.position]).toEqual([1, 2, 2]);
    expect(refilled).toMatchObject({ status: 'ready', id: photoId(4) });
    await expect(photos.listReady(HOME_A)).resolves.toHaveLength(3);
  });

  it('Scenario: Límite de 20 fotos - con 20 fotos listas markReady devuelve null y la foto sigue pendiente', async () => {
    for (let n = 1; n <= 20; n += 1) await ready(n);
    await photos.insertPending(pending(21));

    await expect(photos.markReady(HOME_A, photoId(21))).resolves.toBeNull();

    await expect(photos.find(HOME_A, photoId(21))).resolves.toMatchObject({ status: 'pending' });
    await expect(photos.countReady(HOME_A)).resolves.toBe(20);
  });

  it('confirmaciones simultáneas de la misma vivienda reciben posiciones distintas y nunca pasan de 20', async () => {
    for (let n = 1; n <= 24; n += 1) await photos.insertPending(pending(n));

    const results = await Promise.all(
      Array.from({ length: 24 }, (_, index) => photos.markReady(HOME_A, photoId(index + 1))),
    );

    const positions = results.flatMap((result) => (result ? [result.position] : []));
    expect(results.filter((result) => result === null)).toHaveLength(4);
    expect([...positions].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  });

  it('markReady sobre una foto ya lista la devuelve tal cual', async () => {
    const first = await ready(1);

    await expect(photos.markReady(HOME_A, photoId(1))).resolves.toEqual(first);
  });

  it('lista las fotos listas por posición, y las de varias viviendas sin mezclar', async () => {
    await ready(1);
    await ready(2);
    await ready(3, HOME_B);
    await photos.insertPending(pending(4));

    const homeA = await photos.listReady(HOME_A);
    const both = await photos.listReadyByHomes([HOME_A, HOME_B]);

    expect(homeA.map((photo) => [photo.id, photo.position])).toEqual([
      [photoId(1), 1],
      [photoId(2), 2],
    ]);
    expect(both.map((photo) => [photo.homeId, photo.position])).toEqual([
      [HOME_A, 1],
      [HOME_A, 2],
      [HOME_B, 1],
    ]);
    await expect(photos.listReadyByHomes([])).resolves.toEqual([]);
    await expect(photos.countReady(HOME_B)).resolves.toBe(1);
  });

  it('borrar una foto solo afecta a su vivienda', async () => {
    await ready(1);

    await photos.delete(HOME_B, photoId(1));
    await expect(photos.countReady(HOME_A)).resolves.toBe(1);

    await photos.delete(HOME_A, photoId(1));
    await expect(photos.find(HOME_A, photoId(1))).resolves.toBeNull();
  });

  it('las fotos desaparecen con su vivienda', async () => {
    await ready(1);
    await sql`DELETE FROM homes WHERE id = ${HOME_A}`;

    const [row] = await sql<{ total: string }[]>`SELECT count(*) AS total FROM home_photos`;
    expect(row?.total).toBe('0');
  });
});
