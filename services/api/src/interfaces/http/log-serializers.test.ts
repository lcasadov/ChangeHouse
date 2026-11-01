import { describe, expect, it } from 'vitest';

import { captureLogs } from '../../../test/http.js';
import { buildApp } from './app.js';
import { serializeError, serializeRequest } from './log-serializers.js';

const request = (url: string) => ({
  method: 'GET',
  url,
  headers: { 'accept-version': '1.0.0' },
  host: 'api.test',
  ip: '203.0.113.7',
  socket: { remotePort: 4433 },
});

describe('serializeRequest', () => {
  it('Scenario: Búsqueda de usuarios en los registros - la URL se registra sin query string', () => {
    const serialized = serializeRequest(request('/v1/admin/users?q=ana%40example.com&limit=20'));

    expect(serialized).toEqual({
      method: 'GET',
      url: '/v1/admin/users',
      version: '1.0.0',
      host: 'api.test',
      remoteAddress: '203.0.113.7',
      remotePort: 4433,
    });
    expect(JSON.stringify(serialized)).not.toContain('example.com');
  });

  it('una URL sin query string, o con una `?` vacía, queda igual de limpia', () => {
    expect(serializeRequest(request('/v1/me')).url).toBe('/v1/me');
    expect(serializeRequest(request('/v1/me?')).url).toBe('/v1/me');
  });

  it('tolera una petición sin socket ni cabeceras', () => {
    expect(serializeRequest({ method: 'GET', url: '/x?y=1' })).toMatchObject({
      url: '/x',
      remotePort: undefined,
    });
  });
});

/** Un error como el que lanza postgres.js: el detalle trae los valores de la fila. */
function postgresError(): Error {
  return Object.assign(
    new Error('duplicate key value violates unique constraint "users_email_key"'),
    {
      name: 'PostgresError',
      severity: 'ERROR',
      code: '23505',
      detail: 'Key (email)=(ana@example.com) already exists.',
      where: 'SQL statement "INSERT ... ana@example.com"',
      parameters: ['ana@example.com'],
      constraint_name: 'users_email_key',
      table_name: 'users',
    },
  );
}

describe('serializeError', () => {
  it('Scenario: Error de PostgreSQL sin detail - omite el detalle, el contexto y los parámetros', () => {
    const serialized = serializeError(postgresError()) as Record<string, unknown>;

    expect(serialized).not.toHaveProperty('detail');
    expect(serialized).not.toHaveProperty('where');
    expect(serialized).not.toHaveProperty('parameters');
    expect(JSON.stringify(serialized)).not.toContain('ana@example.com');
  });

  it('conserva lo que sirve para diagnosticar: tipo, mensaje, traza, código y restricción', () => {
    const serialized = serializeError(postgresError()) as Record<string, unknown>;

    expect(serialized).toMatchObject({
      type: 'PostgresError',
      message: 'duplicate key value violates unique constraint "users_email_key"',
      code: '23505',
      constraint_name: 'users_email_key',
      table_name: 'users',
    });
    expect(typeof serialized['stack']).toBe('string');
  });

  it('un error de Drizzle lleva los parámetros en su mensaje, en `params` y en la causa: nada de eso se registra', () => {
    const drizzle = Object.assign(
      new Error('Failed query: insert into "users" ("email") values ($1)\nparams: ana@example.com'),
      {
        name: 'DrizzleQueryError',
        query: 'insert into "users" ("email") values ($1)',
        params: ['ana@example.com'],
        cause: postgresError(),
      },
    );

    const serialized = serializeError(drizzle) as Record<string, unknown>;

    expect(JSON.stringify(serialized)).not.toContain('ana@example.com');
    expect(serialized['message']).toBe('Failed query: insert into "users" ("email") values ($1)');
    expect(serialized['cause']).toMatchObject({ type: 'PostgresError', code: '23505' });
  });

  it('lo que no es un Error se registra tal cual', () => {
    expect(serializeError('texto')).toBe('texto');
    expect(serializeError(undefined)).toBeUndefined();
  });
});

describe('registro de la aplicación', () => {
  function appWithRoutes(logs: ReturnType<typeof captureLogs>) {
    const app = buildApp({
      logger: logs.options,
      security: { policy: { probe: { kind: 'public' } } },
    });
    app.get('/v1/search', { config: { operationId: 'probe' } }, () => ({ ok: true }));
    app.get('/v1/db-error', { config: { operationId: 'probe' } }, () => {
      throw postgresError();
    });
    return app;
  }

  it('Scenario: Búsqueda de usuarios en los registros - ninguna línea del registro contiene lo buscado', async () => {
    const logs = captureLogs();
    const app = appWithRoutes(logs);

    await app.inject({ method: 'GET', url: '/v1/search?q=ana%40example.com' });
    await app.close();

    expect(logs.text()).toContain('/v1/search');
    expect(logs.text()).not.toContain('example.com');
    expect(logs.text()).not.toContain('q=');
  });

  it('Scenario: Error de PostgreSQL sin detail - un fallo de la base de datos se registra sin valores de filas', async () => {
    const logs = captureLogs();
    const app = appWithRoutes(logs);

    const response = await app.inject({ method: 'GET', url: '/v1/db-error?q=ana%40example.com' });
    await app.close();

    expect(response.statusCode).toBe(500);
    expect(logs.text()).toContain('users_email_key');
    expect(logs.text()).not.toContain('ana@example.com');
    expect(logs.text()).not.toContain('already exists');
  });
});
