import { createApiClient } from '../../api/client';
import { json, problem } from '../../test-support/http-responses';
import { ChatApiError } from './chat-api';
import { createHttpChatApi } from './http-chat-api';

const MATCH = '0198f3a0-cccc-7000-8000-000000000001';

interface Seen {
  method: string;
  path: string;
  authorization: string | null;
  body: unknown;
}

function setup(respond: () => Response | Promise<Response>) {
  const seen: Seen[] = [];
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getToken: () => Promise.resolve('token'),
    fetch: async (request) => {
      const raw = await request.text();
      seen.push({
        method: request.method,
        path: new URL(request.url).pathname,
        authorization: request.headers.get('authorization'),
        body: raw === '' ? undefined : (JSON.parse(raw) as unknown),
      });
      return respond();
    },
  });
  return { api: createHttpChatApi(client), seen };
}

async function failureOf(action: Promise<unknown>): Promise<ChatApiError | string> {
  try {
    await action;
  } catch (error) {
    return error instanceof ChatApiError ? error : 'otro-error';
  }
  return 'sin-error';
}

describe('sendMessage', () => {
  it('envía un texto con el token y devuelve el id del mensaje', async () => {
    const { api, seen } = setup(() =>
      json(201, { id: 'm-1', kind: 'text', text: 'Hola', createdAt: '2026-10-19T10:00:00Z' }),
    );

    await expect(api.sendMessage(MATCH, { text: 'Hola' })).resolves.toEqual({ id: 'm-1' });

    expect(seen).toEqual([
      {
        method: 'POST',
        path: `/matches/${MATCH}/messages`,
        authorization: 'Bearer token',
        body: { text: 'Hola' },
      },
    ]);
  });

  it('envía una imagen con el id de su subida', async () => {
    const { api, seen } = setup(() =>
      json(201, { id: 'm-2', kind: 'image', createdAt: '2026-10-19T10:00:00Z' }),
    );
    const imageUploadId = '0198f3a0-aaaa-7000-8000-000000000009';

    await api.sendMessage(MATCH, { imageUploadId });

    expect(seen[0]?.body).toEqual({ imageUploadId });
  });

  it.each([
    [
      '400 con texto demasiado largo',
      () => problem(400, { errors: [{ field: 'text', message: 'too_long' }] }),
      'too-long',
    ],
    [
      '400 con texto vacío',
      () => problem(400, { errors: [{ field: 'text', message: 'required' }] }),
      'invalid',
    ],
    ['401', () => problem(401), 'unauthorized'],
    ['403', () => problem(403), 'forbidden'],
    ['404', () => problem(404), 'not-found'],
    ['409 MATCH_NOT_OPEN', () => problem(409, { code: 'MATCH_NOT_OPEN' }), 'not-open'],
    ['409 CHAT_NOT_READY', () => problem(409, { code: 'CHAT_NOT_READY' }), 'not-ready'],
    ['409 sin código conocido', () => problem(409), 'server'],
    ['422 INVALID_IMAGE', () => problem(422, { code: 'INVALID_IMAGE' }), 'invalid-image'],
    [
      '422 IMAGE_NOT_UPLOADED',
      () => problem(422, { code: 'IMAGE_NOT_UPLOADED' }),
      'image-not-uploaded',
    ],
    ['500', () => problem(500), 'server'],
  ] as const)('traduce %s a %s', async (_title, respond, kind) => {
    const { api } = setup(respond);

    expect(await failureOf(api.sendMessage(MATCH, { text: 'Hola' }))).toMatchObject({ kind });
  });

  it('un fallo de red se normaliza', async () => {
    const { api } = setup(() => {
      throw new TypeError('Failed to fetch');
    });

    expect(await failureOf(api.sendMessage(MATCH, { text: 'Hola' }))).toMatchObject({
      kind: 'network',
    });
  });
});

describe('createImageUpload', () => {
  it('pide la URL firmada con el tipo de la imagen', async () => {
    const { api, seen } = setup(() =>
      json(201, {
        uploadId: 'u-1',
        uploadUrl: 'https://storage.test/up',
        expiresAt: '2026-10-19T10:15:00Z',
      }),
    );

    await expect(api.createImageUpload(MATCH, 'image/png')).resolves.toEqual({
      uploadId: 'u-1',
      uploadUrl: 'https://storage.test/up',
    });

    expect(seen[0]).toMatchObject({
      method: 'POST',
      path: `/matches/${MATCH}/chat/image-uploads`,
      body: { contentType: 'image/png' },
    });
  });

  it('Scenario: Demasiadas imágenes en una hora - un 429 CHAT_IMAGE_RATE_LIMITED es rate-limited', async () => {
    const { api } = setup(() =>
      problem(429, { code: 'CHAT_IMAGE_RATE_LIMITED' }, { 'retry-after': '1800' }),
    );

    expect(await failureOf(api.createImageUpload(MATCH, 'image/png'))).toMatchObject({
      kind: 'rate-limited',
    });
  });

  it('un envío con el procesado de imágenes saturado (503 IMAGE_PROCESSING_BUSY) es busy', async () => {
    const { api } = setup(() =>
      problem(503, { code: 'IMAGE_PROCESSING_BUSY' }, { 'retry-after': '5' }),
    );

    expect(await failureOf(api.sendMessage(MATCH, { imageUploadId: 'u-1' }))).toMatchObject({
      kind: 'busy',
    });
  });

  it('traduce un match cerrado', async () => {
    const { api } = setup(() => problem(409, { code: 'MATCH_NOT_OPEN' }));

    expect(await failureOf(api.createImageUpload(MATCH, 'image/png'))).toMatchObject({
      kind: 'not-open',
    });
  });
});

describe('getImageUrl', () => {
  it('cambia el id de la imagen por su URL firmada y la fecha en que caduca', async () => {
    const { api, seen } = setup(() =>
      json(200, { url: 'https://storage.test/img', expiresAt: '2026-10-19T10:15:00.000Z' }),
    );

    const result = await api.getImageUrl(MATCH, 'img-1');

    expect(result.url).toBe('https://storage.test/img');
    expect(result.expiresAt.toISOString()).toBe('2026-10-19T10:15:00.000Z');
    expect(seen[0]).toMatchObject({
      method: 'GET',
      path: `/matches/${MATCH}/chat/images/img-1`,
    });
  });

  it('traduce un 404 y un fallo de red', async () => {
    expect(await failureOf(setup(() => problem(404)).api.getImageUrl(MATCH, 'x'))).toMatchObject({
      kind: 'not-found',
    });
    const offline = setup(() => {
      throw new TypeError('Failed to fetch');
    });
    expect(await failureOf(offline.api.getImageUrl(MATCH, 'x'))).toMatchObject({
      kind: 'network',
    });
  });
});
