import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { principalOf } from '../../../../test/http.js';
import type { MatchDetailView, MatchView } from '../../../application/matching/match-views.js';
import { encodeCursor } from '../../../application/moderation/cursor.js';
import type { Role } from '../../../domain/account/role.js';
import { MatchNotFoundError, MatchNotOpenError } from '../../../domain/matching/errors.js';
import { buildApp } from '../app.js';
import type { MatchRouteOptions } from './matches.js';

const MATCH_ID = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9a';
const MATCH = { id: MATCH_ID, type: 2, status: 'open' } as unknown as MatchView;
const DETAIL = { ...MATCH, homes: [] } as unknown as MatchDetailView;
const MESSAGE = {
  id: '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9b',
  kind: 'text',
  text: 'Hola',
  imageUrl: null,
  createdAt: '2026-10-19T10:00:00.000Z',
} as const;
const UPLOAD = {
  uploadId: '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9c',
  uploadUrl: 'https://storage.test/upload',
  expiresAt: '2026-10-19T10:15:00.000Z',
};
const IMAGE_URL = { url: 'https://storage.test/read', expiresAt: '2026-10-19T10:15:00.000Z' };
const IMAGE_ID = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9d';
const UPLOAD_ID = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9c';
const AUTH = { authorization: 'Bearer token-de-prueba' };
const NOW = new Date('2026-10-19T10:00:00.000Z');

const opened: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((app) => app.close()));
});

function setup(role: Role | undefined = 'owner', overrides: Partial<MatchRouteOptions> = {}) {
  const calls: unknown[][] = [];
  const matches: MatchRouteOptions = {
    listMyMatches: (...args) => {
      calls.push(args);
      return Promise.resolve({ items: [MATCH], nextCursor: null });
    },
    getMatch: (...args) => {
      calls.push(args);
      return Promise.resolve(DETAIL);
    },
    confirmMatch: (...args) => {
      calls.push(args);
      return Promise.resolve(MATCH);
    },
    withdrawFromMatch: (...args) => {
      calls.push(args);
      return Promise.resolve(MATCH);
    },
    setPhoneSharing: (...args) => {
      calls.push(args);
      return Promise.resolve();
    },
    sendMatchMessage: (...args) => {
      calls.push(args);
      return Promise.resolve(MESSAGE);
    },
    createChatImageUpload: (...args) => {
      calls.push(args);
      return Promise.resolve(UPLOAD);
    },
    getChatImageUrl: (...args) => {
      calls.push(args);
      return Promise.resolve(IMAGE_URL);
    },
    ...overrides,
  };
  const app = buildApp({
    logger: false,
    security: { authenticate: () => Promise.resolve(principalOf(role, 'user-1')) },
    matches,
  });
  opened.push(app);
  return { app, calls };
}

const errorFields = (body: { errors?: { field: string }[] }) =>
  (body.errors ?? []).map((error) => error.field);

describe('GET /matches', () => {
  it('devuelve la página de matches del usuario con el límite por defecto', async () => {
    const { app, calls } = setup();

    const response = await app.inject({ method: 'GET', url: '/v1/matches', headers: AUTH });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [MATCH], nextCursor: null });
    expect(calls).toEqual([['user-1', { limit: 20 }]]);
  });

  it('entiende status, cursor y limit', async () => {
    const { app, calls } = setup('seeker');
    const cursor = encodeCursor({ at: NOW, id: MATCH_ID });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/matches?status=closed&limit=5&cursor=${cursor}`,
      headers: AUTH,
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([
      ['user-1', { status: 'closed', after: { at: NOW, id: MATCH_ID }, limit: 5 }],
    ]);
  });

  it('un estado, un cursor o un límite no válidos son un 400 con cada campo señalado', async () => {
    const { app, calls } = setup();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/matches?status=abierto&limit=0&cursor=no-es-un-cursor',
      headers: AUTH,
    });

    expect(response.statusCode).toBe(400);
    expect(errorFields(response.json()).sort()).toEqual(['cursor', 'limit', 'status']);
    expect(calls).toEqual([]);
  });

  it('agency y admin reciben 403 y sin token es 401', async () => {
    for (const role of ['agency', 'admin'] as const) {
      const { app } = setup(role);
      const response = await app.inject({ method: 'GET', url: '/v1/matches', headers: AUTH });
      expect(response.statusCode, role).toBe(403);
    }
    const { app } = setup();
    const anonymous = await app.inject({ method: 'GET', url: '/v1/matches' });
    expect(anonymous.statusCode).toBe(401);
  });
});

describe('GET /matches/:matchId', () => {
  const url = `/v1/matches/${MATCH_ID}`;

  it('devuelve el detalle con la cuenta y el rol de quien consulta', async () => {
    const { app, calls } = setup('owner');

    const response = await app.inject({ method: 'GET', url, headers: AUTH });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(DETAIL);
    expect(calls).toEqual([[{ userId: 'user-1', role: 'owner' }, MATCH_ID]]);
  });

  it('el admin y el seeker llegan al caso de uso; agency y sin token no', async () => {
    for (const role of ['admin', 'seeker'] as const) {
      const { app, calls } = setup(role);
      const response = await app.inject({ method: 'GET', url, headers: AUTH });
      expect(response.statusCode, role).toBe(200);
      expect(calls, role).toHaveLength(1);
    }
    const { app, calls } = setup('agency');
    const denied = await app.inject({ method: 'GET', url, headers: AUTH });
    const anonymous = await app.inject({ method: 'GET', url });
    expect([denied.statusCode, anonymous.statusCode]).toEqual([403, 401]);
    expect(calls).toEqual([]);
  });

  it('un identificador que no es UUID responde 404 sin consultar nada', async () => {
    const { app, calls } = setup();

    const response = await app.inject({ method: 'GET', url: '/v1/matches/xyz', headers: AUTH });

    expect(response.statusCode).toBe(404);
    expect(calls).toEqual([]);
  });

  it('un match ajeno o inexistente es un 404 sin código', async () => {
    const { app } = setup('owner', { getMatch: () => Promise.reject(new MatchNotFoundError()) });

    const response = await app.inject({ method: 'GET', url, headers: AUTH });

    expect(response.statusCode).toBe(404);
    expect(response.json()).not.toHaveProperty('code');
  });
});

describe('POST /matches/:matchId/confirm y /withdraw', () => {
  const post = (app: FastifyInstance, action: string, headers: Record<string, string> = AUTH) =>
    app.inject({ method: 'POST', url: `/v1/matches/${MATCH_ID}/${action}`, headers });

  it('Scenario: Primera confirmación - confirmMatch responde 200 con el match', async () => {
    const { app, calls } = setup('seeker');

    const response = await post(app, 'confirm');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(MATCH);
    expect(calls).toEqual([['user-1', MATCH_ID]]);
  });

  it('Scenario: Retirarse - withdrawFromMatch responde 200 con el match', async () => {
    const { app, calls } = setup();

    const response = await post(app, 'withdraw');

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([['user-1', MATCH_ID]]);
  });

  it('Scenario: Match cerrado - un match que no admite la acción responde 409 con MATCH_NOT_OPEN', async () => {
    const reject = () => Promise.reject(new MatchNotOpenError());
    const { app } = setup('owner', { confirmMatch: reject, withdrawFromMatch: reject });

    for (const action of ['confirm', 'withdraw']) {
      const response = await post(app, action);
      expect(response.statusCode, action).toBe(409);
      expect(response.json(), action).toMatchObject({ code: 'MATCH_NOT_OPEN' });
    }
  });

  it('admin y agency reciben 403, sin token 401 y un id que no es UUID 404', async () => {
    for (const role of ['admin', 'agency'] as const) {
      const { app, calls } = setup(role);
      for (const action of ['confirm', 'withdraw']) {
        expect((await post(app, action)).statusCode, `${role} ${action}`).toBe(403);
      }
      expect(calls).toEqual([]);
    }
    const { app } = setup();
    const anonymous = await post(app, 'confirm', {});
    const malformed = await app.inject({
      method: 'POST',
      url: '/v1/matches/xyz/withdraw',
      headers: AUTH,
    });
    expect([anonymous.statusCode, malformed.statusCode]).toEqual([401, 404]);
  });
});

describe('PUT /matches/:matchId/phone-sharing', () => {
  const put = (
    app: FastifyInstance,
    payload: unknown,
    url = `/v1/matches/${MATCH_ID}/phone-sharing`,
  ) => app.inject({ method: 'PUT', url, headers: AUTH, payload: payload as object });

  it('Scenario: Autorizar y revocar - guarda la preferencia propia y responde 204', async () => {
    const { app, calls } = setup();

    const authorize = await put(app, { share: true });
    const revoke = await put(app, { share: false });

    expect([authorize.statusCode, revoke.statusCode]).toEqual([204, 204]);
    expect(authorize.body).toBe('');
    expect(calls).toEqual([
      ['user-1', MATCH_ID, true],
      ['user-1', MATCH_ID, false],
    ]);
  });

  it('un cuerpo sin share booleano o con campos de más es un 400 con el campo señalado', async () => {
    const { app, calls } = setup();

    const missing = await put(app, {});
    const text = await put(app, { share: 'si' });
    const extra = await put(app, { share: true, userId: 'otro' });
    const notAnObject = await put(app, [true]);

    expect([missing, text, extra, notAnObject].map((r) => r.statusCode)).toEqual([
      400, 400, 400, 400,
    ]);
    expect(errorFields(missing.json())).toEqual(['share']);
    expect(errorFields(text.json())).toEqual(['share']);
    expect(errorFields(extra.json())).toEqual(['userId']);
    expect(calls).toEqual([]);
  });

  it('un match cerrado responde 409, un id que no es UUID 404 y admin 403', async () => {
    const closed = await put(
      setup('owner', { setPhoneSharing: () => Promise.reject(new MatchNotOpenError()) }).app,
      { share: true },
    );
    const { app } = setup();
    const malformed = await put(app, { share: true }, '/v1/matches/xyz/phone-sharing');
    const admin = await put(setup('admin').app, { share: true });

    expect([closed.statusCode, malformed.statusCode, admin.statusCode]).toEqual([409, 404, 403]);
  });
});

describe('POST /matches/:matchId/messages', () => {
  const url = `/v1/matches/${MATCH_ID}/messages`;
  const send = (app: FastifyInstance, payload: unknown) =>
    app.inject({ method: 'POST', url, headers: AUTH, payload: payload as object });

  it('envía un texto con la cuenta de quien llama y responde 201 con el mensaje', async () => {
    const { app, calls } = setup('owner');

    const response = await send(app, { text: '  Hola  ' });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(MESSAGE);
    expect(calls).toEqual([['user-1', MATCH_ID, { kind: 'text', text: 'Hola' }]]);
  });

  it('envía una imagen subida', async () => {
    const { app, calls } = setup('seeker');

    const response = await send(app, { imageUploadId: UPLOAD_ID });

    expect(response.statusCode).toBe(201);
    expect(calls).toEqual([['user-1', MATCH_ID, { kind: 'image', imageUploadId: UPLOAD_ID }]]);
  });

  it('Scenario: Mensaje demasiado largo - 2.001 caracteres responde 400 señalando text y no llama al caso de uso', async () => {
    const { app, calls } = setup();

    const response = await send(app, { text: 'a'.repeat(2001) });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errors: [{ field: 'text', message: 'too_long' }] });
    expect(calls).toEqual([]);
  });

  it.each([
    ['vacío', { text: '' }, 'required'],
    ['sin contenido', {}, 'required'],
    ['con texto e imagen', { text: 'a', imageUploadId: UPLOAD_ID }, 'invalid'],
  ])('un mensaje %s responde 400', async (_name, payload, message) => {
    const { app, calls } = setup();

    const response = await send(app, payload);

    expect(response.statusCode).toBe(400);
    expect(response.json<{ errors: { message: string }[] }>().errors[0]?.message).toBe(message);
    expect(calls).toEqual([]);
  });

  it('un matchId que no es UUID responde 404 como un match inexistente', async () => {
    const { app, calls } = setup();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/matches/no-es-uuid/messages',
      headers: AUTH,
      payload: { text: 'hola' },
    });

    expect(response.statusCode).toBe(404);
    expect(calls).toEqual([]);
  });

  it.each([
    ['no participante', new MatchNotFoundError(), 404],
    ['match cerrado', new MatchNotOpenError(), 409],
  ])('%s: traduce el error del caso de uso a su estado HTTP', async (_name, error, status) => {
    const { app } = setup('owner', { sendMatchMessage: () => Promise.reject(error) });

    const response = await send(app, { text: 'hola' });

    expect(response.statusCode).toBe(status);
  });

  it('agency y admin reciben 403 y sin token es 401', async () => {
    for (const role of ['agency', 'admin'] as const) {
      const { app, calls } = setup(role);
      expect((await send(app, { text: 'hola' })).statusCode, role).toBe(403);
      expect(calls).toEqual([]);
    }
    const { app } = setup();
    const anonymous = await app.inject({ method: 'POST', url, payload: { text: 'hola' } });
    expect(anonymous.statusCode).toBe(401);
  });
});

describe('POST /matches/:matchId/chat/image-uploads', () => {
  const url = `/v1/matches/${MATCH_ID}/chat/image-uploads`;

  it('emite la URL de subida y responde 201', async () => {
    const { app, calls } = setup();

    const response = await app.inject({
      method: 'POST',
      url,
      headers: AUTH,
      payload: { contentType: 'image/png' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(UPLOAD);
    expect(calls).toEqual([['user-1', MATCH_ID, 'image/png']]);
  });

  it.each([{ contentType: 'image/gif' }, {}, { contentType: 'image/png', extra: 1 }])(
    'un cuerpo no válido (%j) responde 400',
    async (payload) => {
      const { app, calls } = setup();

      const response = await app.inject({ method: 'POST', url, headers: AUTH, payload });

      expect(response.statusCode).toBe(400);
      expect(calls).toEqual([]);
    },
  );

  it('un matchId que no es UUID responde 404, y agency y admin 403', async () => {
    const { app } = setup();
    const missing = await app.inject({
      method: 'POST',
      url: '/v1/matches/no-es-uuid/chat/image-uploads',
      headers: AUTH,
      payload: { contentType: 'image/png' },
    });
    expect(missing.statusCode).toBe(404);
    for (const role of ['agency', 'admin'] as const) {
      const { app: other } = setup(role);
      const response = await other.inject({
        method: 'POST',
        url,
        headers: AUTH,
        payload: { contentType: 'image/png' },
      });
      expect(response.statusCode, role).toBe(403);
    }
  });
});

describe('GET /matches/:matchId/chat/images/:imageId', () => {
  const url = `/v1/matches/${MATCH_ID}/chat/images/${IMAGE_ID}`;

  it('devuelve la URL firmada de la imagen con la cuenta de quien llama', async () => {
    const { app, calls } = setup('seeker');

    const response = await app.inject({ method: 'GET', url, headers: AUTH });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(IMAGE_URL);
    expect(calls).toEqual([['user-1', MATCH_ID, IMAGE_ID]]);
  });

  it('un matchId o un imageId que no son UUID responden 404 sin llamar al caso de uso', async () => {
    const { app, calls } = setup();

    for (const bad of [
      `/v1/matches/no-es-uuid/chat/images/${IMAGE_ID}`,
      `/v1/matches/${MATCH_ID}/chat/images/ruta-de-almacenamiento`,
    ]) {
      const response = await app.inject({ method: 'GET', url: bad, headers: AUTH });
      expect(response.statusCode, bad).toBe(404);
    }
    expect(calls).toEqual([]);
  });

  it('traduce el 404 del caso de uso; agency y admin reciben 403 y sin token es 401', async () => {
    const { app } = setup('owner', {
      getChatImageUrl: () => Promise.reject(new MatchNotFoundError()),
    });
    expect((await app.inject({ method: 'GET', url, headers: AUTH })).statusCode).toBe(404);
    for (const role of ['agency', 'admin'] as const) {
      const { app: other } = setup(role);
      const response = await other.inject({ method: 'GET', url, headers: AUTH });
      expect(response.statusCode, role).toBe(403);
    }
    const { app: anonymous } = setup();
    expect((await anonymous.inject({ method: 'GET', url })).statusCode).toBe(401);
  });
});
