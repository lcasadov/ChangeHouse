import { FIXTURE_PLACES, PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { emulatorAvailable, type EmulatorUser, signUp } from '../../../../test/auth-emulator.js';
import { openSql, testConfig, testStorageConfig } from '../../../../test/fixtures.js';
import { jpeg, jpegWithGps } from '../../../../test/images.js';
import { createApi } from '../../../bootstrap.js';

const MALASANA = FIXTURE_PLACES[0]!;
const ADDRESS = { placeId: MALASANA.placeId, formatted: MALASANA.formatted };
const COMPLETE = {
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
const MISSING_ID = '0199c1a2-0000-7000-8000-000000000000';
const storage = testStorageConfig();

const sql = openSql();
let app: FastifyInstance;
let close: () => Promise<void>;

type Json = Record<string, unknown>;
type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const bearer = (user: Pick<EmulatorUser, 'idToken'>) => ({
  authorization: `Bearer ${user.idToken}`,
});

function call(user: EmulatorUser, method: Method, url: string, payload?: object) {
  return app.inject({ method, url, headers: bearer(user), ...(payload ? { payload } : {}) });
}

async function registered(): Promise<EmulatorUser> {
  const user = await signUp();
  const response = await app.inject({
    method: 'PUT',
    url: '/v1/me',
    headers: bearer(user),
    payload: {
      displayName: 'Ana',
      acceptedTermsVersion: TERMS_VERSION,
      acceptedPrivacyVersion: PRIVACY_VERSION,
    },
  });
  expect(response.statusCode).toBe(201);
  return user;
}

async function createHome(user: EmulatorUser, extra: object = {}): Promise<string> {
  const response = await call(user, 'POST', '/v1/homes', {
    type: 'piso',
    address: ADDRESS,
    ...extra,
  });
  expect(response.statusCode, response.body).toBe(201);
  return response.json<{ id: string }>().id;
}

/** El cliente: pide la URL firmada y sube el original directamente al almacenamiento, sin pasar por la API. */
async function requestAndUpload(
  user: EmulatorUser,
  homeId: string,
  content: Buffer,
  contentType = 'image/jpeg',
): Promise<string> {
  const created = await call(user, 'POST', `/v1/homes/${homeId}/photos`, { contentType });
  expect(created.statusCode, created.body).toBe(201);
  const { photoId, uploadUrl } = created.json<{ photoId: string; uploadUrl: string }>();
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: new Uint8Array(content),
  });
  expect(put.ok, await put.clone().text()).toBe(true);
  return photoId;
}

const complete = (user: EmulatorUser, homeId: string, photoId: string) =>
  call(user, 'POST', `/v1/homes/${homeId}/photos/${photoId}/complete`);

async function addReadyPhotos(homeId: string, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let position = 1; position <= count; position += 1) {
    const id = crypto.randomUUID();
    ids.push(id);
    await sql`INSERT INTO home_photos (id, home_id, status, storage_path, position)
              VALUES (${id}, ${homeId}, 'ready', ${`homes/${homeId}/${id}.webp`}, ${position})`;
  }
  return ids;
}

async function privateObjectExists(path: string): Promise<boolean> {
  const url = `http://${storage.emulatorHost}/storage/v1/b/${storage.privateBucket}/o/${encodeURIComponent(path)}`;
  return (await fetch(url)).status === 200;
}

beforeAll(() => {
  ({ app, close } = createApi(testConfig()));
});

beforeEach(async () => {
  await sql`TRUNCATE users CASCADE`;
});

afterAll(async () => {
  await close();
  await sql.end();
});

describe.skipIf(!emulatorAvailable())('fotos de la vivienda con tokens reales', () => {
  it('Scenario: Subir una foto - emite la URL, el cliente sube el original, se confirma y la foto aparece en la vivienda', async () => {
    const user = await registered();
    const homeId = await createHome(user);

    const created = await call(user, 'POST', `/v1/homes/${homeId}/photos`, {
      contentType: 'image/jpeg',
    });
    const upload = created.json<{ photoId: string; uploadUrl: string; expiresAt: string }>();
    const before = await call(user, 'GET', `/v1/homes/${homeId}`);
    await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      body: new Uint8Array(await jpeg(1200, 800)),
    });
    const confirmed = await complete(user, homeId, upload.photoId);
    const after = await call(user, 'GET', `/v1/homes/${homeId}`);

    expect(created.statusCode).toBe(201);
    expect(new URL(upload.uploadUrl).pathname).toBe(
      `/${storage.privateBucket}/originals/${homeId}/${upload.photoId}`,
    );
    const minutes = (Date.parse(upload.expiresAt) - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);
    expect(before.json<Json>()['photos']).toEqual([]);
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toEqual({
      id: upload.photoId,
      url: `${storage.publicBaseUrl}/homes/${homeId}/${upload.photoId}.webp`,
      position: 1,
    });
    expect(after.json<Json>()['photos']).toEqual([confirmed.json()]);
    const served = await fetch(confirmed.json<{ url: string }>().url);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/webp');
    expect(await privateObjectExists(`originals/${homeId}/${upload.photoId}`)).toBe(false);
  });

  it('Scenario: Foto con coordenadas GPS - la imagen publicada no contiene metadatos EXIF y su lado mayor no supera 2048 px', async () => {
    const user = await registered();
    const homeId = await createHome(user);
    const original = await jpegWithGps(4000, 3000);
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const photoId = await requestAndUpload(user, homeId, original);

    const confirmed = await complete(user, homeId, photoId);

    expect(confirmed.statusCode).toBe(200);
    const published = Buffer.from(
      await (await fetch(confirmed.json<{ url: string }>().url)).arrayBuffer(),
    );
    const metadata = await sharp(published).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.exif).toBeUndefined();
    expect(published.includes(Buffer.from('Cámara de prueba'))).toBe(false);
    expect(Math.max(metadata.width, metadata.height)).toBe(2048);
  });

  it('Scenario: Subida sin confirmar - la foto no aparece ni para su propietario ni para otro usuario, y sigue pending', async () => {
    const owner = await registered();
    const viewer = await registered();
    const homeId = await createHome(owner, COMPLETE);
    await addReadyPhotos(homeId, 3);
    await sql`UPDATE homes SET status = 'published'`;
    const unconfirmed = await requestAndUpload(owner, homeId, await jpeg());

    const own = await call(owner, 'GET', `/v1/homes/${homeId}`);
    const foreign = await call(viewer, 'GET', `/v1/homes/${homeId}`);
    const list = await call(owner, 'GET', '/v1/me/homes');

    for (const response of [own, foreign]) {
      expect(response.json<{ photos: { id: string }[] }>().photos).toHaveLength(3);
      expect(JSON.stringify(response.json())).not.toContain(unconfirmed);
    }
    expect(list.json<{ photos: unknown[] }[]>()[0]?.photos).toHaveLength(3);
    const [row] = await sql<{ status: string; position: number | null }[]>`
      SELECT status, position FROM home_photos WHERE id = ${unconfirmed}`;
    expect(row).toEqual({ status: 'pending', position: null });
  });

  it('confirmar antes de subir el fichero es un 422 y la foto sigue pending hasta que se suba', async () => {
    const user = await registered();
    const homeId = await createHome(user);
    const created = await call(user, 'POST', `/v1/homes/${homeId}/photos`, {
      contentType: 'image/png',
    });
    const { photoId, uploadUrl } = created.json<{ photoId: string; uploadUrl: string }>();

    const early = await complete(user, homeId, photoId);
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: new Uint8Array(
        await sharp(await jpeg())
          .png()
          .toBuffer(),
      ),
    });
    const later = await complete(user, homeId, photoId);

    expect(early.statusCode).toBe(422);
    expect(early.json()).toMatchObject({ code: 'PHOTO_NOT_UPLOADED' });
    expect(later.statusCode).toBe(200);
  });

  it('confirmar dos veces la misma foto devuelve la misma sin duplicarla', async () => {
    const user = await registered();
    const homeId = await createHome(user);
    const photoId = await requestAndUpload(user, homeId, await jpeg());

    const first = await complete(user, homeId, photoId);
    const second = await complete(user, homeId, photoId);

    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    expect(await sql`SELECT 1 FROM home_photos`).toHaveLength(1);
  });

  it('Scenario: Fichero que no es una imagen - 422 INVALID_IMAGE, la foto no se publica y el fichero se elimina', async () => {
    const user = await registered();
    const homeId = await createHome(user);
    const photoId = await requestAndUpload(user, homeId, Buffer.from('%PDF-1.7 no soy una foto'));

    const response = await complete(user, homeId, photoId);

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'INVALID_IMAGE' });
    expect(await sql`SELECT 1 FROM home_photos`).toHaveLength(0);
    expect(await privateObjectExists(`originals/${homeId}/${photoId}`)).toBe(false);
    const published = await fetch(`${storage.publicBaseUrl}/homes/${homeId}/${photoId}.webp`);
    expect(published.status).toBe(404);
  });

  it('Scenario: Demasiadas fotos pendientes - con 25 pendientes pedir otra URL da 409 TOO_MANY_PENDING_PHOTOS y no crea la foto', async () => {
    const user = await registered();
    const homeId = await createHome(user);
    for (let index = 0; index < 25; index += 1) {
      const id = crypto.randomUUID();
      await sql`INSERT INTO home_photos (id, home_id, status, storage_path)
                VALUES (${id}, ${homeId}, 'pending', ${`homes/${homeId}/${id}.webp`})`;
    }

    const response = await call(user, 'POST', `/v1/homes/${homeId}/photos`, {
      contentType: 'image/jpeg',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'TOO_MANY_PENDING_PHOTOS' });
    expect(await sql`SELECT 1 FROM home_photos`).toHaveLength(25);
  });

  it('Scenario: Imagen con demasiados píxeles - confirmar una foto de 10.000 × 10.000 da 422 INVALID_IMAGE y no se publica', async () => {
    const user = await registered();
    const homeId = await createHome(user);
    const huge = await sharp({
      create: { width: 10_000, height: 10_000, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png({ compressionLevel: 1 })
      .toBuffer();
    const photoId = await requestAndUpload(user, homeId, huge, 'image/png');

    const response = await complete(user, homeId, photoId);

    expect(response.statusCode, response.body).toBe(422);
    expect(response.json()).toMatchObject({ code: 'INVALID_IMAGE' });
    expect(await sql`SELECT 1 FROM home_photos`).toHaveLength(0);
    expect((await fetch(`${storage.publicBaseUrl}/homes/${homeId}/${photoId}.webp`)).status).toBe(
      404,
    );
  });

  it('Scenario: Límite de 20 fotos - con 20 fotos listas pedir otra URL da 409 y no crea nada', async () => {
    const user = await registered();
    const homeId = await createHome(user);
    await addReadyPhotos(homeId, 20);

    const response = await call(user, 'POST', `/v1/homes/${homeId}/photos`, {
      contentType: 'image/jpeg',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'PHOTO_LIMIT_REACHED' });
    expect(await sql`SELECT 1 FROM home_photos`).toHaveLength(20);
  });

  it('si al confirmar ya hay 20 listas, la 21 se descarta con 409 y sin dejar ficheros', async () => {
    const user = await registered();
    const homeId = await createHome(user);
    const photoId = await requestAndUpload(user, homeId, await jpeg());
    await addReadyPhotos(homeId, 20);

    const response = await complete(user, homeId, photoId);

    expect(response.statusCode).toBe(409);
    expect(await sql`SELECT 1 FROM home_photos`).toHaveLength(20);
    expect(await privateObjectExists(`originals/${homeId}/${photoId}`)).toBe(false);
    expect((await fetch(`${storage.publicBaseUrl}/homes/${homeId}/${photoId}.webp`)).status).toBe(
      404,
    );
  });

  it('Scenario: Borrar por debajo del mínimo en una vivienda publicada - con 3 fotos da 409 y la foto se mantiene', async () => {
    const user = await registered();
    const homeId = await createHome(user, COMPLETE);
    const [first] = await addReadyPhotos(homeId, 3);
    await sql`UPDATE homes SET status = 'published'`;

    const response = await call(user, 'DELETE', `/v1/homes/${homeId}/photos/${String(first)}`);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'HOME_MIN_PHOTOS' });
    expect(await sql`SELECT 1 FROM home_photos`).toHaveLength(3);
  });

  it('con 4 fotos se puede borrar una de una vivienda publicada: 204 y se borra también el fichero publicado', async () => {
    const user = await registered();
    const homeId = await createHome(user, COMPLETE);
    await addReadyPhotos(homeId, 3);
    const photoId = await requestAndUpload(user, homeId, await jpeg());
    const confirmed = await complete(user, homeId, photoId);
    await sql`UPDATE homes SET status = 'published'`;

    const response = await call(user, 'DELETE', `/v1/homes/${homeId}/photos/${photoId}`);

    expect(response.statusCode).toBe(204);
    expect(await sql`SELECT 1 FROM home_photos`).toHaveLength(3);
    expect((await fetch(confirmed.json<{ url: string }>().url)).status).toBe(404);
  });

  it('Scenario: Envío con menos de 3 fotos - 422 que señala photos y la vivienda sigue en draft', async () => {
    const user = await registered();
    const homeId = await createHome(user, COMPLETE);
    await addReadyPhotos(homeId, 2);
    await requestAndUpload(user, homeId, await jpeg());

    const response = await call(user, 'POST', `/v1/homes/${homeId}/submit`);

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      code: 'HOME_INCOMPLETE',
      errors: [{ field: 'photos' }],
    });
    const [row] = await sql<{ status: string }[]>`SELECT status FROM homes`;
    expect(row?.status).toBe('draft');
  });

  it('Scenario: Envío de una ficha completa - con 3 fotos subidas y confirmadas pasa a in_review', async () => {
    const user = await registered();
    const homeId = await createHome(user, COMPLETE);
    for (let n = 0; n < 3; n += 1) {
      const photoId = await requestAndUpload(user, homeId, await jpeg(800, 600));
      expect((await complete(user, homeId, photoId)).statusCode).toBe(200);
    }

    const response = await call(user, 'POST', `/v1/homes/${homeId}/submit`);

    expect(response.statusCode).toBe(200);
    const view = response.json<{ status: string; photos: { position: number }[] }>();
    expect(view.status).toBe('in_review');
    expect(view.photos.map((photo) => photo.position)).toEqual([1, 2, 3]);
  });

  it('Scenario: Vivienda ajena no publicada - pedir, confirmar o borrar una foto en la vivienda de otro es un 404', async () => {
    const owner = await registered();
    const intruder = await registered();
    const homeId = await createHome(owner);
    const photoId = await requestAndUpload(owner, homeId, await jpeg());

    const create = await call(intruder, 'POST', `/v1/homes/${homeId}/photos`, {
      contentType: 'image/jpeg',
    });
    const confirm = await complete(intruder, homeId, photoId);
    const remove = await call(intruder, 'DELETE', `/v1/homes/${homeId}/photos/${photoId}`);

    expect([create.statusCode, confirm.statusCode, remove.statusCode]).toEqual([404, 404, 404]);
    expect((await sql`SELECT 1 FROM home_photos`).length).toBe(1);
  });

  it('una foto o una vivienda que no existen son un 404, igual que un identificador mal formado', async () => {
    const user = await registered();
    const homeId = await createHome(user);

    const missingPhoto = await complete(user, homeId, MISSING_ID);
    const missingHome = await call(user, 'DELETE', `/v1/homes/${MISSING_ID}/photos/${MISSING_ID}`);
    const malformed = await call(user, 'DELETE', `/v1/homes/${homeId}/photos/no-es-uuid`);

    expect([missingPhoto.statusCode, missingHome.statusCode, malformed.statusCode]).toEqual([
      404, 404, 404,
    ]);
  });

  it('un tipo de contenido que no es una foto admitida es un 400 y no emite ninguna URL', async () => {
    const user = await registered();
    const homeId = await createHome(user);

    const response = await call(user, 'POST', `/v1/homes/${homeId}/photos`, {
      contentType: 'application/pdf',
    });

    expect(response.statusCode).toBe(400);
    expect(await sql`SELECT 1 FROM home_photos`).toHaveLength(0);
  });

  it('Scenario: Edición de una vivienda en operación - no admite fotos nuevas (409)', async () => {
    const user = await registered();
    const homeId = await createHome(user);
    await sql`UPDATE homes SET status = 'in_operation'`;

    const response = await call(user, 'POST', `/v1/homes/${homeId}/photos`, {
      contentType: 'image/jpeg',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'HOME_NOT_EDITABLE' });
  });
});
