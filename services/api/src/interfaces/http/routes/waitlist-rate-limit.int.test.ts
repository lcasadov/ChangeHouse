import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openSql, testConfig } from '../../../../test/fixtures.js';
import { createApi } from '../../../bootstrap.js';
import type { ApiConfig } from '../../../config.js';

const sql = openSql();
let app: FastifyInstance;
let close: () => Promise<void>;

function start(overrides: Partial<ApiConfig>) {
  ({ app, close } = createApi(testConfig(overrides)));
}

function join(
  email: string,
  options: { remoteAddress?: string; headers?: Record<string, string> } = {},
) {
  return app.inject({
    method: 'POST',
    url: '/v1/waitlist',
    payload: {
      email,
      municipality: 'Madrid',
      homeType: 'piso',
      lookingFor: 'Un ático',
      consent: true,
    },
    ...options,
  });
}

async function emailsSaved(): Promise<string[]> {
  const rows = await sql<{ email: string }[]>`SELECT email FROM waitlist ORDER BY email`;
  return rows.map((row) => row.email);
}

beforeEach(async () => {
  await sql`TRUNCATE waitlist`;
});

afterEach(async () => {
  await close();
});

describe('límite de altas por origen', () => {
  it('Scenario: Demasiadas altas seguidas - la sexta alta con la configuración por defecto recibe 429 con Retry-After y no se guarda', async () => {
    start({ waitlistRateLimit: { max: 5, windowSeconds: 600 } });

    const statuses: number[] = [];
    for (let index = 1; index <= 5; index++) {
      statuses.push((await join(`persona${String(index)}@example.com`)).statusCode);
    }
    const blocked = await join('sexta@example.com');

    expect(statuses).toEqual([202, 202, 202, 202, 202]);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['content-type']).toContain('application/problem+json');
    const retryAfter = Number(blocked.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(600);
    expect(blocked.json<{ status: number; correlationId: string }>()).toMatchObject({
      status: 429,
      correlationId: expect.any(String) as unknown,
    });
    expect(await emailsSaved()).not.toContain('sexta@example.com');
    expect(await emailsSaved()).toHaveLength(5);
  });

  it('Scenario: Demasiadas altas seguidas - el máximo se configura por entorno y cada origen tiene su cuenta', async () => {
    start({ waitlistRateLimit: { max: 1, windowSeconds: 600 } });

    const first = await join('a@example.com', { remoteAddress: '198.51.100.1' });
    const sameOrigin = await join('b@example.com', { remoteAddress: '198.51.100.1' });
    const otherOrigin = await join('c@example.com', { remoteAddress: '198.51.100.2' });

    expect([first.statusCode, sameOrigin.statusCode, otherOrigin.statusCode]).toEqual([
      202, 429, 202,
    ]);
    expect(await emailsSaved()).toEqual(['a@example.com', 'c@example.com']);
  });

  it('Scenario: Demasiadas altas seguidas - tras el proxy cuenta la IP real del cliente y no la que este inventa', async () => {
    start({ trustProxyHops: 1, waitlistRateLimit: { max: 1, windowSeconds: 600 } });
    const viaProxy = (email: string, forwardedFor: string) =>
      join(email, {
        remoteAddress: '10.0.0.9',
        headers: { 'x-forwarded-for': forwardedFor },
      });

    const first = await viaProxy('a@example.com', 'inventada-1, 203.0.113.7');
    const spoofed = await viaProxy('b@example.com', 'inventada-2, 203.0.113.7');
    const other = await viaProxy('c@example.com', 'inventada-1, 203.0.113.8');

    expect([first.statusCode, spoofed.statusCode, other.statusCode]).toEqual([202, 429, 202]);
  });

  it('Scenario: Demasiadas altas seguidas - la petición previa de CORS no consume el límite', async () => {
    start({ waitlistRateLimit: { max: 1, windowSeconds: 600 } });

    for (let attempt = 0; attempt < 3; attempt++) {
      const preflight = await app.inject({
        method: 'OPTIONS',
        url: '/v1/waitlist',
        headers: { origin: 'https://landing.test', 'access-control-request-method': 'POST' },
      });
      expect(preflight.statusCode).toBe(204);
    }
    const response = await join('a@example.com');

    expect(response.statusCode).toBe(202);
  });
});
