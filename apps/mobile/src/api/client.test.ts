import { FakeBackend } from '../test-support/fake-backend';
import { createApiClient } from './client';

describe('createApiClient', () => {
  it('añade el ID token como Bearer en cada petición, contra la URL base', async () => {
    const backend = new FakeBackend({ registered: true });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      getToken: () => Promise.resolve('el-token'),
      fetch: backend.fetch,
    });

    const { response } = await client.GET('/me');

    expect(response.status).toBe(200);
    expect(backend.requests).toEqual([
      { method: 'GET', path: '/me', authorization: 'Bearer el-token', body: undefined },
    ]);
  });

  it('pide el token en cada petición, de modo que siempre se envía el vigente', async () => {
    const backend = new FakeBackend({ registered: true });
    const tokens = ['primero', 'segundo'];
    const client = createApiClient({
      baseUrl: 'https://api.test',
      getToken: () => Promise.resolve(tokens.shift() ?? null),
      fetch: backend.fetch,
    });

    await client.GET('/me');
    await client.GET('/me');

    expect(backend.requests.map((request) => request.authorization)).toEqual([
      'Bearer primero',
      'Bearer segundo',
    ]);
  });

  it('sin sesión no envía cabecera de autorización', async () => {
    const backend = new FakeBackend({ registered: true });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      getToken: () => Promise.resolve(null),
      fetch: backend.fetch,
    });

    await client.GET('/me');

    expect(backend.requests[0]?.authorization).toBeNull();
  });
});
