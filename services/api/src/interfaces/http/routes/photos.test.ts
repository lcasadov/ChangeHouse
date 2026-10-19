import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { principalOf } from '../../../../test/http.js';
import { HomeNotFoundError, PhotoNotFoundError } from '../../../application/home/errors.js';
import type { PhotoUploadView, PhotoView } from '../../../application/home/home-views.js';
import type { Role } from '../../../domain/account/role.js';
import {
  HomeMinPhotosError,
  InvalidImageError,
  PhotoLimitReachedError,
  PhotoNotUploadedError,
} from '../../../domain/home/errors.js';
import { buildApp } from '../app.js';
import type { PhotoRouteOptions } from './photos.js';

const HOME_ID = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9a';
const PHOTO_ID = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9b';
const UPLOAD: PhotoUploadView = {
  photoId: PHOTO_ID,
  uploadUrl: 'https://storage.test/upload',
  expiresAt: '2026-10-19T10:15:00.000Z',
};
const PHOTO: PhotoView = { id: PHOTO_ID, url: 'https://cdn.test/foto.webp', position: 1 };
const AUTH = { authorization: 'Bearer token-de-prueba' };

const opened: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((app) => app.close()));
});

function setup(options: { role?: Role | undefined; failWith?: Error } = {}) {
  const calls: { operation: string; args: unknown[] }[] = [];
  const respond = <T>(operation: string, value: T) => {
    return (...args: unknown[]): Promise<T> => {
      calls.push({ operation, args });
      return options.failWith ? Promise.reject(options.failWith) : Promise.resolve(value);
    };
  };
  const photos: PhotoRouteOptions = {
    createPhotoUpload: respond('createPhotoUpload', UPLOAD),
    completePhotoUpload: respond('completePhotoUpload', PHOTO),
    deletePhoto: respond('deletePhoto', undefined),
  };
  const app = buildApp({
    logger: false,
    security: { authenticate: () => Promise.resolve(principalOf(options.role)) },
    photos,
  });
  opened.push(app);
  return { app, calls };
}

const create = (
  app: FastifyInstance,
  payload: object = { contentType: 'image/jpeg' },
  homeId = HOME_ID,
) =>
  app.inject({
    method: 'POST',
    url: `/v1/homes/${homeId}/photos`,
    headers: AUTH,
    payload,
  });

describe('POST /homes/{homeId}/photos', () => {
  it('Scenario: Subir una foto - responde 201 con la URL firmada y delega con el tipo de contenido', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await create(app, { contentType: 'image/heic' });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(UPLOAD);
    expect(calls).toEqual([
      { operation: 'createPhotoUpload', args: ['user-1', HOME_ID, 'image/heic'] },
    ]);
  });

  it.each([
    [{ contentType: 'image/gif' }, ['contentType']],
    [{}, ['contentType']],
    [{ contentType: 'image/png', url: 'x' }, ['url']],
  ])('un cuerpo %j es un 400 que señala %j, sin ejecutar nada', async (payload, fields) => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await create(app, payload);

    expect(response.statusCode).toBe(400);
    expect(response.json<{ errors: { field: string }[] }>().errors.map((e) => e.field)).toEqual(
      fields,
    );
    expect(calls).toEqual([]);
  });

  it('Scenario: Límite de 20 fotos - responde 409 con su código', async () => {
    const { app } = setup({ role: 'owner', failWith: new PhotoLimitReachedError() });

    const response = await create(app);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'PHOTO_LIMIT_REACHED' });
  });

  it('un identificador de vivienda que no es un UUID es un 404 sin consultar nada', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await create(app, { contentType: 'image/jpeg' }, 'no-es-uuid');

    expect(response.statusCode).toBe(404);
    expect(calls).toEqual([]);
  });

  it('Scenario: Vivienda ajena no publicada - responde 404 sin código', async () => {
    const { app } = setup({ role: 'owner', failWith: new HomeNotFoundError() });

    const response = await create(app);

    expect(response.statusCode).toBe(404);
    expect(response.json()).not.toHaveProperty('code');
  });

  it.each(['agency', 'admin'] as const)('%s recibe 403 y no se ejecuta nada', async (role) => {
    const { app, calls } = setup({ role });

    expect((await create(app)).statusCode).toBe(403);
    expect(calls).toEqual([]);
  });

  it('sin token responde 401', async () => {
    const { app } = setup({ role: 'owner' });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/homes/${HOME_ID}/photos`,
      payload: {},
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /homes/{homeId}/photos/{photoId}/complete', () => {
  const complete = (app: FastifyInstance, photoId = PHOTO_ID) =>
    app.inject({
      method: 'POST',
      url: `/v1/homes/${HOME_ID}/photos/${photoId}/complete`,
      headers: AUTH,
    });

  it('Scenario: Subir una foto - responde 200 con la foto procesada y delega', async () => {
    const { app, calls } = setup({ role: 'seeker' });

    const response = await complete(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(PHOTO);
    expect(calls).toEqual([
      { operation: 'completePhotoUpload', args: ['user-1', HOME_ID, PHOTO_ID] },
    ]);
  });

  it('Scenario: Fichero que no es una imagen - responde 422 con su código', async () => {
    const { app } = setup({ role: 'owner', failWith: new InvalidImageError() });

    const response = await complete(app);

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'INVALID_IMAGE' });
  });

  it('una subida sin hacer responde 422 con su código', async () => {
    const { app } = setup({ role: 'owner', failWith: new PhotoNotUploadedError() });

    const response = await complete(app);

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'PHOTO_NOT_UPLOADED' });
  });

  it('una foto que no existe y un identificador que no es un UUID son el mismo 404', async () => {
    const missing = setup({ role: 'owner', failWith: new PhotoNotFoundError() });
    const malformed = setup({ role: 'owner' });

    const first = await complete(missing.app);
    const second = await complete(malformed.app, 'no-es-uuid');

    expect([first.statusCode, second.statusCode]).toEqual([404, 404]);
    expect(malformed.calls).toEqual([]);
  });

  it('una gestoría recibe 403', async () => {
    const { app, calls } = setup({ role: 'agency' });

    expect((await complete(app)).statusCode).toBe(403);
    expect(calls).toEqual([]);
  });
});

describe('DELETE /homes/{homeId}/photos/{photoId}', () => {
  const remove = (app: FastifyInstance, photoId = PHOTO_ID) =>
    app.inject({
      method: 'DELETE',
      url: `/v1/homes/${HOME_ID}/photos/${photoId}`,
      headers: AUTH,
    });

  it('responde 204 sin cuerpo y delega', async () => {
    const { app, calls } = setup({ role: 'owner' });

    const response = await remove(app);

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(calls).toEqual([{ operation: 'deletePhoto', args: ['user-1', HOME_ID, PHOTO_ID] }]);
  });

  it('Scenario: Borrar por debajo del mínimo en una vivienda publicada - responde 409 con su código', async () => {
    const { app } = setup({ role: 'owner', failWith: new HomeMinPhotosError() });

    const response = await remove(app);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'HOME_MIN_PHOTOS' });
  });

  it('un identificador de foto que no es un UUID es un 404 sin consultar nada', async () => {
    const { app, calls } = setup({ role: 'owner' });

    expect((await remove(app, 'no-es-uuid')).statusCode).toBe(404);
    expect(calls).toEqual([]);
  });

  it('un administrador recibe 403', async () => {
    const { app } = setup({ role: 'admin' });

    expect((await remove(app)).statusCode).toBe(403);
  });
});
