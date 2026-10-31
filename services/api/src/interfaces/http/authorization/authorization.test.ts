import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { captureLogs, principalOf } from '../../../../test/http.js';
import type { Role } from '../../../domain/account/role.js';
import { buildApp } from '../app.js';
import { type Actor, decide, type Policy, policy as realPolicy } from './policy.js';

const testPolicy: Policy = {
  selfRead: { kind: 'roles', roles: ['seeker', 'owner', 'agency', 'admin'], denyStatus: 404 },
  adminListHomes: { kind: 'roles', roles: ['admin'] },
  anyone: { kind: 'authenticated' },
  openDoor: { kind: 'public' },
};

const opened: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((instance) => instance.close()));
});

function setup(actor: Actor | 'anon') {
  const logs = captureLogs();
  const app = buildApp({
    logger: logs.options,
    security: {
      authenticate: () =>
        Promise.resolve(
          principalOf(actor === 'anon' || actor === 'unregistered' ? undefined : actor),
        ),
      policy: testPolicy,
    },
  });
  app.get('/me', { config: { operationId: 'selfRead' } }, () => ({ ok: true }));
  app.get('/admin/homes', { config: { operationId: 'adminListHomes' } }, () => ({ ok: true }));
  app.get('/anyone', { config: { operationId: 'anyone' } }, () => ({ ok: true }));
  app.get('/ghost', { config: { operationId: 'ghostOperation' } }, () => ({ ok: true }));
  app.get('/nameless', () => ({ ok: true }));
  opened.push(app);
  return { app, logs };
}

const get = (app: FastifyInstance, url: string, actor: Actor | 'anon') =>
  app.inject({
    method: 'GET',
    url,
    headers: actor === 'anon' ? {} : { authorization: 'Bearer token-de-prueba' },
  });

describe('decide', () => {
  it('una operación pública admite a cualquiera', () => {
    for (const actor of ['unregistered', 'seeker', 'owner', 'agency', 'admin'] as const) {
      expect(decide({ kind: 'public' }, actor)).toEqual({ allowed: true });
    }
  });

  it('una operación para cualquier autenticado admite también a quien no está dado de alta', () => {
    for (const actor of ['unregistered', 'seeker', 'owner', 'agency', 'admin'] as const) {
      expect(decide({ kind: 'authenticated' }, actor)).toEqual({ allowed: true });
    }
  });

  it('una operación por roles admite solo los listados y deniega con 403 por defecto', () => {
    const access = { kind: 'roles', roles: ['admin'] } as const;

    expect(decide(access, 'admin')).toEqual({ allowed: true });
    for (const actor of ['unregistered', 'seeker', 'owner', 'agency'] as const) {
      expect(decide(access, actor)).toEqual({ allowed: false, status: 403 });
    }
  });

  it('una operación puede declarar 404 como respuesta de denegación', () => {
    const access = { kind: 'roles', roles: ['seeker'], denyStatus: 404 } as const;

    expect(decide(access, 'unregistered')).toEqual({ allowed: false, status: 404 });
  });
});

describe('política de autorización', () => {
  it('declara solo las operaciones implementadas, con la lista de roles de la matriz', () => {
    const everyone: Role[] = ['seeker', 'owner', 'agency', 'admin'];

    expect(realPolicy).toEqual({
      joinWaitlist: { kind: 'public' },
      upsertMe: { kind: 'authenticated' },
      getMe: { kind: 'roles', roles: everyone, denyStatus: 404 },
      listMyConsents: { kind: 'roles', roles: everyone, denyStatus: 404 },
      acceptConsent: { kind: 'roles', roles: everyone, denyStatus: 404 },
      registerDevice: { kind: 'roles', roles: everyone, denyStatus: 404 },
      // RC-19: agency y admin no publican ni gestionan viviendas; getHome añade al admin (forma pública)
      listMyHomes: { kind: 'roles', roles: ['seeker', 'owner'] },
      createHome: { kind: 'roles', roles: ['seeker', 'owner'] },
      updateHome: { kind: 'roles', roles: ['seeker', 'owner'] },
      submitHome: { kind: 'roles', roles: ['seeker', 'owner'] },
      // Pausar y reactivar: mismos roles que la vivienda; el estado (409) lo resuelve el caso de uso
      pauseHome: { kind: 'roles', roles: ['seeker', 'owner'] },
      resumeHome: { kind: 'roles', roles: ['seeker', 'owner'] },
      createHomePhotoUpload: { kind: 'roles', roles: ['seeker', 'owner'] },
      completeHomePhotoUpload: { kind: 'roles', roles: ['seeker', 'owner'] },
      deleteHomePhoto: { kind: 'roles', roles: ['seeker', 'owner'] },
      getHome: { kind: 'roles', roles: ['seeker', 'owner', 'admin'] },
      // Preferencias de búsqueda: mismos roles que las viviendas; la propiedad de la vivienda la resuelve el caso de uso
      getMySearchPreferences: { kind: 'roles', roles: ['seeker', 'owner'] },
      putMySearchPreferences: { kind: 'roles', roles: ['seeker', 'owner'] },
      getHomeSearchPreferences: { kind: 'roles', roles: ['seeker', 'owner'] },
      putHomeSearchPreferences: { kind: 'roles', roles: ['seeker', 'owner'] },
      deleteHomeSearchPreferences: { kind: 'roles', roles: ['seeker', 'owner'] },
      // Descubrimiento: owner y seeker; la vivienda desde la que se busca la resuelve el caso de uso
      discoverHomes: { kind: 'roles', roles: ['seeker', 'owner'] },
      // Decisiones: el me gusta exige vivienda publicada (RN-01), es decir, owner; descartar y deshacer
      // también las puede hacer un seeker desde su cuenta
      likeHome: { kind: 'roles', roles: ['owner'] },
      dismissHome: { kind: 'roles', roles: ['seeker', 'owner'] },
      undoLastAction: { kind: 'roles', roles: ['seeker', 'owner'] },
      // Matches: los propios; un seeker (p. ej. con su vivienda pausada) también los consulta
      listMyMatches: { kind: 'roles', roles: ['seeker', 'owner'] },
      // El detalle también lo consulta el admin (sin teléfonos ni direcciones); confirmar, retirarse y
      // compartir el teléfono son de participantes. La pertenencia al match la resuelve el caso de uso
      getMatch: { kind: 'roles', roles: ['seeker', 'owner', 'admin'] },
      confirmMatch: { kind: 'roles', roles: ['seeker', 'owner'] },
      withdrawFromMatch: { kind: 'roles', roles: ['seeker', 'owner'] },
      setPhoneSharing: { kind: 'roles', roles: ['seeker', 'owner'] },
      // Chat: solo participantes (seeker u owner); la pertenencia la resuelve el caso de uso con un 404
      getChatImageUrl: { kind: 'roles', roles: ['seeker', 'owner'] },
      createChatImageUpload: { kind: 'roles', roles: ['seeker', 'owner'] },
      sendMatchMessage: { kind: 'roles', roles: ['seeker', 'owner'] },
      // Moderación: solo el admin (RF-18, RF-93)
      adminListHomes: { kind: 'roles', roles: ['admin'] },
      adminModerateHome: { kind: 'roles', roles: ['admin'] },
    });
  });
});

describe('autorización centralizada', () => {
  it('Scenario: Operación sin regla - un usuario autenticado recibe 403 y no se ejecuta', async () => {
    const { app } = setup('admin');

    const response = await get(app, '/ghost', 'admin');

    expect(response.statusCode).toBe(403);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });

  it('Scenario: Operación sin regla - una ruta sin operationId también se deniega', async () => {
    const { app } = setup('admin');

    const response = await get(app, '/nameless', 'admin');

    expect(response.statusCode).toBe(403);
  });

  it('una operación sin regla pide antes la autenticación: sin token es 401, no 403', async () => {
    const { app } = setup('anon');

    const response = await get(app, '/ghost', 'anon');

    expect(response.statusCode).toBe(401);
  });

  it('Scenario: Endpoint de administración sin el rol - seeker y owner reciben 403 Problem con correlationId y queda registrado', async () => {
    for (const role of ['seeker', 'owner'] as const) {
      const { app, logs } = setup(role);

      const response = await app.inject({
        method: 'GET',
        url: '/admin/homes',
        headers: { authorization: 'Bearer token-de-prueba', 'x-correlation-id': `corr-${role}` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        type: 'https://changehouse.app/problems/forbidden',
        status: 403,
        correlationId: `corr-${role}`,
      });
      expect(Object.keys(response.json<object>()).sort()).toEqual([
        'correlationId',
        'status',
        'title',
        'type',
      ]);
      expect(logs.parsed().find((entry) => entry['event'] === 'auth.forbidden')).toMatchObject({
        level: 40,
        correlationId: `corr-${role}`,
        userId: 'user-1',
        operationId: 'adminListHomes',
      });
    }
  });

  it('el admin accede a la administración', async () => {
    const { app } = setup('admin');

    expect((await get(app, '/admin/homes', 'admin')).statusCode).toBe(200);
  });

  it('quien no está dado de alta solo puede usar las operaciones para cualquier autenticado', async () => {
    const { app } = setup('unregistered');

    expect((await get(app, '/anyone', 'unregistered')).statusCode).toBe(200);
    expect((await get(app, '/admin/homes', 'unregistered')).statusCode).toBe(403);
  });

  it('las operaciones sobre la propia cuenta responden 404 a quien aún no tiene cuenta, sin distinguirse de una ruta inexistente', async () => {
    const { app } = setup('unregistered');

    const denied = await get(app, '/me', 'unregistered');
    const missing = await get(app, '/no-existe', 'unregistered');

    expect(denied.statusCode).toBe(404);
    expect({ ...denied.json<object>(), correlationId: '' }).toEqual({
      ...missing.json<object>(),
      correlationId: '',
    });
  });

  it('cualquier rol con cuenta accede a la operación sobre la propia cuenta', async () => {
    for (const role of ['seeker', 'owner', 'agency', 'admin'] as const) {
      const { app } = setup(role);

      expect((await get(app, '/me', role)).statusCode).toBe(200);
    }
  });

  it('el identificador del usuario se registra en el 404 de denegación, sin datos personales', async () => {
    const { app, logs } = setup('unregistered');

    await get(app, '/me', 'unregistered');

    const entry = logs.parsed().find((line) => line['event'] === 'auth.not-found');
    expect(entry).toMatchObject({ level: 30, operationId: 'selfRead' });
    expect(logs.text()).not.toContain('ana@example.com');
  });
});
