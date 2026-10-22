import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { captureLogs, principalOf } from '../../../../test/http.js';
import { InvalidTokenError } from '../../../application/auth/identity-verifier.js';
import type { Principal } from '../../../application/auth/principal.js';
import { buildApp } from '../app.js';
import type { Policy } from './policy.js';

const SECRET_TOKEN = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJzZWNyZXRvLXVuaXF1ZSJ9.firma-secreta-unica';

const policy: Policy = {
  whoami: { kind: 'authenticated' },
  openDoor: { kind: 'public' },
};

let app: FastifyInstance;
afterEach(async () => {
  await app.close();
});

function setup(authenticate: (token: string) => Promise<Principal>, logs = captureLogs()) {
  app = buildApp({ logger: logs.options, security: { authenticate, policy } });
  let handled = 0;
  app.get('/whoami', { config: { operationId: 'whoami' } }, (request) => {
    handled += 1;
    return { uid: request.principal?.identity.uid };
  });
  app.get('/open', { config: { operationId: 'openDoor' } }, () => ({ open: true }));
  return { logs, handled: () => handled };
}

const accept = () => Promise.resolve(principalOf('seeker'));
const reject = () => Promise.reject(new InvalidTokenError());

/** El cuerpo sin el identificador de correlación, que cambia en cada petición. */
const withoutCorrelation = (response: { json: <T>() => T }) => ({
  ...response.json<object>(),
  correlationId: '',
});

describe('autenticación de las peticiones', () => {
  it('Scenario: Petición sin token - 401 en formato Problem sin indicar el motivo', async () => {
    const { handled } = setup(accept);

    const response = await app.inject({ method: 'GET', url: '/whoami' });

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.headers['www-authenticate']).toBe('Bearer');
    const body = response.json<Record<string, unknown>>();
    expect(Object.keys(body).sort()).toEqual(['correlationId', 'status', 'title', 'type']);
    expect(body['type']).toBe('https://changehouse.app/problems/unauthorized');
    expect(body['correlationId']).toBe(response.headers['x-correlation-id']);
    expect(handled()).toBe(0);
  });

  it.each(['Basic dXNlcjpwYXNz', 'Bearer', 'Bearer ', 'Bearer a b', 'bearer', 'Token abc'])(
    'una cabecera Authorization mal formada (%j) da el mismo 401 sin consultar al verificador',
    async (header) => {
      let calls = 0;
      setup(() => {
        calls += 1;
        return accept();
      });
      const anonymous = await app.inject({ method: 'GET', url: '/whoami' });

      const response = await app.inject({
        method: 'GET',
        url: '/whoami',
        headers: { authorization: header },
      });

      expect(response.statusCode).toBe(401);
      expect(withoutCorrelation(response)).toEqual(withoutCorrelation(anonymous));
      expect(calls).toBe(0);
    },
  );

  it('Scenario: Token caducado o manipulado - 401 idéntico al de la falta de token y el registro no contiene el token', async () => {
    const { logs } = setup(reject);
    const anonymous = await app.inject({ method: 'GET', url: '/whoami' });

    const response = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: { authorization: `Bearer ${SECRET_TOKEN}`, 'x-correlation-id': 'corr-401' },
    });

    expect(response.statusCode).toBe(401);
    expect(withoutCorrelation(response)).toEqual(withoutCorrelation(anonymous));
    expect(logs.text()).not.toContain(SECRET_TOKEN);
    expect(logs.text()).not.toContain('firma-secreta-unica');
    const denial = logs
      .parsed()
      .filter((entry) => entry['event'] === 'auth.unauthenticated')
      .at(-1);
    expect(denial).toMatchObject({ level: 40, correlationId: 'corr-401', status: 401 });
  });

  it('un token válido llega al manejador con la identidad verificada', async () => {
    const { handled } = setup(accept);

    const response = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: { authorization: `Bearer ${SECRET_TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ uid: 'uid-1' });
    expect(handled()).toBe(1);
  });

  it('el esquema Bearer no distingue mayúsculas', async () => {
    setup(accept);

    const response = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: { authorization: `bEaReR ${SECRET_TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('Scenario: Única operación pública - se procesa sin token y sin consultar al verificador', async () => {
    let calls = 0;
    setup(() => {
      calls += 1;
      return reject();
    });

    const anonymous = await app.inject({ method: 'GET', url: '/open' });
    const garbage = await app.inject({
      method: 'GET',
      url: '/open',
      headers: { authorization: 'Bearer basura' },
    });

    expect(anonymous.statusCode).toBe(200);
    expect(garbage.statusCode).toBe(200);
    expect(calls).toBe(0);
  });

  it('un fallo técnico al verificar no es un 401: responde 500 sin detalle y sin ejecutar la operación', async () => {
    const { logs, handled } = setup(() => Promise.reject(new Error('certificados inaccesibles')));

    const response = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: { authorization: `Bearer ${SECRET_TOKEN}` },
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('certificados');
    expect(handled()).toBe(0);
    expect(logs.text()).not.toContain(SECRET_TOKEN);
  });

  it('sin la configuración de seguridad ninguna operación protegida responde: se cierra por defecto', async () => {
    app = buildApp({ logger: false });
    app.get('/whoami', { config: { operationId: 'whoami' } }, () => ({ ok: true }));

    const response = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: { authorization: 'Bearer cualquiera' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('una ruta que no existe sigue siendo 404 aunque no haya token', async () => {
    setup(accept);

    const response = await app.inject({ method: 'GET', url: '/inexistente' });

    expect(response.statusCode).toBe(404);
  });

  it('la precarga CORS de la landing no pasa por la autenticación', async () => {
    app = buildApp({
      logger: false,
      landingOrigin: 'https://landing.test',
      waitlist: {
        joinWaitlist: () => Promise.resolve(),
        rateLimit: { max: 5, windowSeconds: 60 },
      },
    });

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/waitlist',
      headers: {
        origin: 'https://landing.test',
        'access-control-request-method': 'POST',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://landing.test');
  });
});
