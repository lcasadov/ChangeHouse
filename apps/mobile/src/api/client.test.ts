import { FakeBackend, me } from '../test-support/fake-backend';
import { problem } from '../test-support/http-responses';
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

describe('cuenta suspendida', () => {
  it('Scenario: Usuario suspendido usa la app - un 403 ACCOUNT_SUSPENDED avisa y la respuesta sigue llegando a quien la pidió', async () => {
    const backend = new FakeBackend({ registered: true, profile: me({ suspended: true }) });
    const suspended = jest.fn();
    const client = createApiClient({
      baseUrl: 'https://api.test',
      getToken: () => Promise.resolve('el-token'),
      fetch: backend.fetch,
      onAccountSuspended: suspended,
    });

    const { response, error } = await client.GET('/me/homes');

    expect(suspended).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(403);
    expect(error).toMatchObject({ code: 'ACCOUNT_SUSPENDED' });
  });

  it('otro 403, otro código o una respuesta que no es JSON no avisan', async () => {
    const responses = [
      problem(403),
      problem(409, { code: 'ACCOUNT_SUSPENDED' }),
      new Response('prohibido', { status: 403, headers: { 'content-type': 'text/plain' } }),
    ];
    const suspended = jest.fn();
    const client = createApiClient({
      baseUrl: 'https://api.test',
      getToken: () => Promise.resolve('el-token'),
      fetch: () => Promise.resolve(responses.shift() ?? problem(500)),
      onAccountSuspended: suspended,
    });

    for (let call = 0; call < 3; call += 1) await client.GET('/me/homes');

    expect(suspended).not.toHaveBeenCalled();
  });

  it('sin quien escuche, un 403 ACCOUNT_SUSPENDED no falla', async () => {
    const backend = new FakeBackend({ registered: true, profile: me({ suspended: true }) });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      getToken: () => Promise.resolve('el-token'),
      fetch: backend.fetch,
    });

    await expect(client.GET('/me/homes')).resolves.toMatchObject({
      response: { status: 403 },
    });
  });
});
