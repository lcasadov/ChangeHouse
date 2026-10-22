import { describe, expect, it } from 'vitest';

import { DomainError } from '../../domain/domain-error.js';
import { buildApp } from './app.js';
import { ValidationFailedError } from './problem.js';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Recoge las líneas de log del servidor para comprobar qué se registra y con qué identificador. */
function captureLogs() {
  const lines: Record<string, unknown>[] = [];
  const stream = {
    write(chunk: string) {
      lines.push(JSON.parse(chunk) as Record<string, unknown>);
    },
  };
  return { lines, logger: { level: 'info', stream } };
}

class RuleBrokenError extends DomainError {
  readonly code = 'RULE_BROKEN';
}

const PROBE = { config: { operationId: 'probe' } };

function appWithFailingRoutes(logger?: ReturnType<typeof captureLogs>['logger']) {
  const app = buildApp({
    ...(logger ? { logger } : {}),
    // Estas rutas de prueba son públicas: aquí se prueba el formato de error, no el acceso
    security: { policy: { probe: { kind: 'public' } } },
  });
  app.get('/invalid', PROBE, () => {
    throw new ValidationFailedError([
      { field: 'email', message: 'invalid' },
      { field: 'municipality', message: 'required' },
    ]);
  });
  app.get('/boom', PROBE, () => {
    throw new Error('relation "waitlist" does not exist: SELECT * FROM waitlist WHERE email = $1');
  });
  app.get('/limited', PROBE, () => {
    throw Object.assign(new Error('Rate limit exceeded'), { statusCode: 429 });
  });
  app.get('/rule', PROBE, () => {
    throw new RuleBrokenError('detalle interno que no debe salir');
  });
  app.get('/rule-fields', PROBE, () => {
    throw Object.assign(new RuleBrokenError('otro detalle interno'), { fields: ['email'] });
  });
  app.post('/echo', PROBE, (request) => request.body);
  return app;
}

describe('formato único de error (Problem)', () => {
  it('Scenario: Error de validación - responde 400 en application/problem+json con los campos erróneos y un correlationId', async () => {
    const app = appWithFailingRoutes();

    const response = await app.inject({ method: 'GET', url: '/invalid' });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.json<Record<string, unknown>>();
    expect(body).toMatchObject({
      type: expect.stringMatching(/^https:\/\/changehouse\.app\/problems\/.+/) as unknown,
      title: expect.any(String) as unknown,
      status: 400,
      errors: [
        { field: 'email', message: 'invalid' },
        { field: 'municipality', message: 'required' },
      ],
    });
    expect(body['correlationId']).toMatch(UUID_V7);
    await app.close();
  });

  it('Scenario: Error de validación - un JSON mal formado también devuelve Problem 400', async () => {
    const app = appWithFailingRoutes();

    const response = await app.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{"email":',
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json<Record<string, unknown>>()).toMatchObject({ status: 400 });
    await app.close();
  });

  it('Scenario: Ruta inexistente - devuelve 404 en formato Problem con correlationId', async () => {
    const app = appWithFailingRoutes();

    const response = await app.inject({ method: 'GET', url: '/no-existe' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.json<Record<string, unknown>>();
    expect(body).toMatchObject({ status: 404, title: expect.any(String) as unknown });
    expect(body['correlationId']).toMatch(UUID_V7);
    await app.close();
  });

  it('Scenario: Error inesperado sin detalles internos - 500 genérico sin traza ni SQL y el registro lleva el mismo correlationId', async () => {
    const { lines, logger } = captureLogs();
    const app = appWithFailingRoutes(logger);

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.json<Record<string, unknown>>();
    expect(body).toMatchObject({ status: 500 });
    expect(response.body).not.toMatch(/waitlist|SELECT|stack|\.ts:|node_modules/i);

    const failure = lines.find((line) => line['level'] === 50);
    expect(failure?.['correlationId']).toBe(body['correlationId']);
    expect((failure?.['err'] as { message: string }).message).toContain(
      'relation "waitlist" does not exist',
    );
    await app.close();
  });

  it('Scenario: Error inesperado sin detalles internos - un error con estado 429 conserva el estado y las cabeceras', async () => {
    const app = appWithFailingRoutes();

    const response = await app.inject({ method: 'GET', url: '/limited' });

    expect(response.statusCode).toBe(429);
    expect(response.json<Record<string, unknown>>()).toMatchObject({ status: 429 });
    await app.close();
  });

  it('Scenario: Correlación propagada - la respuesta de error devuelve el X-Correlation-Id recibido', async () => {
    const { lines, logger } = captureLogs();
    const app = appWithFailingRoutes(logger);

    const response = await app.inject({
      method: 'GET',
      url: '/no-existe',
      headers: { 'x-correlation-id': 'front-1234_abc.def' },
    });

    expect(response.json<Record<string, unknown>>()['correlationId']).toBe('front-1234_abc.def');
    expect(response.headers['x-correlation-id']).toBe('front-1234_abc.def');
    expect(lines.some((line) => line['correlationId'] === 'front-1234_abc.def')).toBe(true);
    await app.close();
  });

  it('Scenario: Correlación propagada - un identificador con caracteres no seguros se sustituye por uno generado', async () => {
    const app = appWithFailingRoutes();

    for (const unsafe of ['con espacios', 'a'.repeat(129), 'inyec\tcion']) {
      const response = await app.inject({
        method: 'GET',
        url: '/no-existe',
        headers: { 'x-correlation-id': unsafe },
      });

      expect(response.json<Record<string, unknown>>()['correlationId']).toMatch(UUID_V7);
    }
    await app.close();
  });

  it('Scenario: Correlación propagada - las respuestas correctas también llevan la cabecera', async () => {
    const app = appWithFailingRoutes();

    const response = await app.inject({ method: 'POST', url: '/echo', payload: { ok: true } });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-correlation-id']).toMatch(UUID_V7);
    await app.close();
  });

  it('Scenario: Regla de negocio incumplida - un error de dominio es un 422 con su código estable y sin su mensaje', async () => {
    const app = appWithFailingRoutes();

    const plain = await app.inject({ method: 'GET', url: '/rule' });
    const withFields = await app.inject({ method: 'GET', url: '/rule-fields' });

    expect(plain.statusCode).toBe(422);
    expect(plain.headers['content-type']).toContain('application/problem+json');
    expect(plain.json()).toMatchObject({
      type: 'https://changehouse.app/problems/unprocessable',
      status: 422,
      code: 'RULE_BROKEN',
    });
    expect(plain.json<Record<string, unknown>>()['errors']).toBeUndefined();
    expect(withFields.json()).toMatchObject({ errors: [{ field: 'email', message: 'required' }] });
    expect(plain.body + withFields.body).not.toContain('detalle interno');
    await app.close();
  });
});
