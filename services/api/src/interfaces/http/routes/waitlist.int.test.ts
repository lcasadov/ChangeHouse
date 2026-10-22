import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { openSql, testConfig } from '../../../../test/fixtures.js';
import { createApi } from '../../../bootstrap.js';

const sql = openSql();
let app: FastifyInstance;
let close: () => Promise<void>;

const validBody = {
  email: 'juan@example.com',
  municipality: 'Madrid',
  homeType: 'piso',
  lookingFor: 'Un ático con terraza',
  consent: true,
};

async function join(body: unknown, headers: Record<string, string> = {}) {
  return app.inject({ method: 'POST', url: '/waitlist', payload: body as object, headers });
}

async function countEntries(): Promise<number> {
  const rows = await sql<{ total: number }[]>`SELECT count(*)::int AS total FROM waitlist`;
  return rows[0]?.total ?? -1;
}

function fieldsOf(response: { json: () => unknown }): string[] {
  const body = response.json() as { errors?: { field: string }[] };
  return (body.errors ?? []).map((error) => error.field);
}

beforeAll(() => {
  ({ app, close } = createApi(testConfig()));
});

beforeEach(async () => {
  await sql`TRUNCATE waitlist`;
});

afterAll(async () => {
  await close();
  await sql.end();
});

describe('POST /waitlist', () => {
  it('Scenario: Alta correcta - responde 202 y guarda la inscripción con la fecha del consentimiento', async () => {
    const before = Date.now();

    const response = await join({ ...validBody, email: ' Juan@Example.com ' });

    expect(response.statusCode).toBe(202);
    const rows = await sql<
      {
        email: string;
        municipality: string;
        home_type: string;
        looking_for: string;
        consent_at: Date;
      }[]
    >`SELECT email, municipality, home_type, looking_for, consent_at FROM waitlist`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: 'juan@example.com',
      municipality: 'Madrid',
      home_type: 'piso',
      looking_for: 'Un ático con terraza',
    });
    expect(rows[0]?.consent_at.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(rows[0]?.consent_at.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('Scenario: Sin aceptar la privacidad - 400 señalando consent y sin guardar nada', async () => {
    for (const consent of [false, undefined]) {
      const response = await join({ ...validBody, consent });

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(fieldsOf(response)).toEqual(['consent']);
    }
    expect(await countEntries()).toBe(0);
  });

  it('Scenario: Email no válido - 400 señalando email y sin guardar nada', async () => {
    const response = await join({ ...validBody, email: 'juan@' });

    expect(response.statusCode).toBe(400);
    expect(fieldsOf(response)).toEqual(['email']);
    expect(await countEntries()).toBe(0);
  });

  it('Scenario: Tipo de vivienda desconocido - 400 señalando homeType y la tabla sigue vacía', async () => {
    const response = await join({ ...validBody, homeType: 'castillo' });

    expect(response.statusCode).toBe(400);
    expect(fieldsOf(response)).toEqual(['homeType']);
    expect(await countEntries()).toBe(0);
  });

  it('Scenario: Error de validación - señala cada campo erróneo cuando hay varios y los textos largos', async () => {
    const response = await join({
      ...validBody,
      email: '',
      municipality: '   ',
      lookingFor: 'x'.repeat(501),
    });

    expect(response.statusCode).toBe(400);
    expect(fieldsOf(response)).toEqual(['email', 'municipality', 'lookingFor']);
    expect(await countEntries()).toBe(0);
  });

  it('Scenario: Error de validación - un cuerpo ausente o que no es un objeto devuelve Problem 400', async () => {
    const empty = await app.inject({ method: 'POST', url: '/waitlist' });
    const text = await app.inject({
      method: 'POST',
      url: '/waitlist',
      headers: { 'content-type': 'application/json' },
      payload: '"hola"',
    });

    for (const response of [empty, text]) {
      expect(response.statusCode).toBe(400);
      expect(response.json<{ correlationId: string }>().correlationId).toBeTruthy();
    }
    expect(await countEntries()).toBe(0);
  });

  it('Scenario: Email ya inscrito - la respuesta es idéntica y sigue habiendo una sola inscripción', async () => {
    const first = await join(validBody);
    const second = await join({ ...validBody, email: 'JUAN@EXAMPLE.COM', municipality: 'Getafe' });

    expect(second.statusCode).toBe(first.statusCode);
    expect(second.statusCode).toBe(202);
    expect(second.body).toBe(first.body);
    expect(await countEntries()).toBe(1);
    const [row] = await sql<{ municipality: string }[]>`SELECT municipality FROM waitlist`;
    expect(row?.municipality).toBe('Madrid');
  });

  it('Scenario: Email ya inscrito - dos altas simultáneas con el mismo email dejan una inscripción y ambas reciben 202', async () => {
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        join({ ...validBody, email: index % 2 === 0 ? 'ana@example.com' : 'ANA@example.com' }),
      ),
    );

    expect(responses.map((response) => response.statusCode)).toEqual(Array(6).fill(202));
    expect(await countEntries()).toBe(1);
  });

  it('Scenario: Error inesperado sin detalles internos - un fallo de la base de datos devuelve 500 sin filtrar nada', async () => {
    const broken = createApi(
      testConfig({ databaseUrl: 'postgres://nadie:nada@127.0.0.1:1/ninguna' }),
    );

    const response = await broken.app.inject({
      method: 'POST',
      url: '/waitlist',
      payload: validBody,
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|waitlist|nadie/i);
    await broken.close();
  });
});

describe('CORS de POST /waitlist', () => {
  it('permite solo el origen de la landing', async () => {
    const allowed = await join(validBody, { origin: 'https://landing.test' });
    const denied = await join(validBody, { origin: 'https://otro.test' });

    expect(allowed.headers['access-control-allow-origin']).toBe('https://landing.test');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('responde a la petición previa (preflight) del origen de la landing', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/waitlist',
      headers: {
        origin: 'https://landing.test',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://landing.test');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  it('no concede el preflight a otro origen', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/waitlist',
      headers: { origin: 'https://otro.test', 'access-control-request-method': 'POST' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
