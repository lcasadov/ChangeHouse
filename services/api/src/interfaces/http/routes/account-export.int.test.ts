import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { emulatorAvailable } from '../../../../test/auth-emulator.js';
import { openSql, testConfig } from '../../../../test/fixtures.js';
import { createScenario, POINTS } from '../../../../test/scenario.js';
import { createApi } from '../../../bootstrap.js';
import { AddressCipher } from '../../../infrastructure/crypto/address-cipher.js';
import {
  createDatabase,
  type DatabaseConnection,
} from '../../../infrastructure/persistence/drizzle/database.js';
import { DrizzleHomeRepository } from '../../../infrastructure/persistence/drizzle/drizzle-home-repository.js';

const sql = openSql();
const config = testConfig();
const BETO_PHONE = '+34699888777';
const ANA_PHONE = '+34600111222';
let api: ReturnType<typeof createApi>;
let app: FastifyInstance;
let connection: DatabaseConnection;
let scenario: ReturnType<typeof createScenario>;

const exportOf = (user: { idToken: string }) => scenario.call(user, 'GET', '/v1/me/export');

interface Export {
  account: Record<string, unknown>;
  homes: { id: string; address: string; status: string }[];
  searchPreferences: { default: unknown; byHome: { homeId: string }[] };
  likes: { fromHomeId: string; toHomeId: string }[];
  dismissals: { homeId: string | null; dismissedHomeId: string }[];
  matches: {
    id: string;
    status: string;
    participation: { homeId: string; status: string }[];
    otherHomeIds: string[];
  }[];
  consents: { type: string; version: string; acceptedAt: string }[];
}

beforeAll(() => {
  api = createApi(config);
  app = api.app;
  connection = createDatabase(inject('databaseUrl'));
  scenario = createScenario({
    app,
    sql,
    homes: new DrizzleHomeRepository(
      connection.db,
      AddressCipher.fromBase64(config.addressEncryptionKey),
    ),
  });
});

beforeEach(async () => {
  await api.outbox.idle();
  await sql`TRUNCATE matches, outbox, users CASCADE`;
});

afterAll(async () => {
  await api.close();
  await connection.close();
  await sql.end();
});

describe.skipIf(!emulatorAvailable())('exportMyData con tokens reales y PostgreSQL', () => {
  it('Scenario: Exportación - devuelve un JSON adjunto con los datos propios y de los matches solo la participación propia y los ids de las otras viviendas', async () => {
    const { ana, anaHome, beto, betoHome, matchId } = await scenario.pair({
      ana: 'Ana Propia',
      beto: 'Beatriz Ajena',
    });
    await sql`UPDATE users SET phone = ${ANA_PHONE}, municipality = 'Getafe' WHERE id = ${ana.id}`;
    await sql`UPDATE users SET phone = ${BETO_PHONE}, municipality = 'Leganés' WHERE id = ${beto.id}`;
    await scenario.call(beto, 'PUT', `/v1/matches/${matchId}/phone-sharing`, { share: true });
    const carla = await scenario.registered('Carla Ajena');
    const carlaHome = await scenario.publishedHome(carla, 'Leganés', POINTS.leganes, 150_000);
    await scenario.call(ana, 'POST', '/v1/me/dismissals', {
      fromHomeId: anaHome,
      targetHomeId: carlaHome,
    });
    const draft = await scenario.call(ana, 'POST', '/v1/homes', {
      type: 'piso',
      address: {
        placeId: 'fixture-malasana',
        formatted: 'Calle del Pez, 12, 28004 Madrid, España',
      },
    });
    expect(draft.statusCode, draft.body).toBe(201);

    const response = await exportOf(ana);

    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['content-disposition']).toMatch(/^attachment; filename="[^"]+\.json"$/);
    const data = response.json<Export>();
    expect(data.account).toMatchObject({
      id: ana.id,
      email: ana.email.toLowerCase(),
      displayName: 'Ana Propia',
      phone: ANA_PHONE,
      municipality: 'Getafe',
    });
    expect(data.homes).toHaveLength(2);
    expect(data.homes.find((home) => home.id === anaHome)?.address).toMatch(
      /^Calle Mayor, \d+, Getafe$/,
    );
    expect(data.homes.some((home) => home.address.startsWith('Calle del Pez'))).toBe(true);
    expect(data.searchPreferences.default).toMatchObject({ municipalities: ['Leganés'] });
    expect(data.likes).toEqual([
      expect.objectContaining({ fromHomeId: anaHome, toHomeId: betoHome }),
    ]);
    expect(data.dismissals).toEqual([
      expect.objectContaining({ homeId: anaHome, dismissedHomeId: carlaHome }),
    ]);
    expect(data.matches).toHaveLength(1);
    expect(data.matches[0]).toMatchObject({
      id: matchId,
      status: 'open',
      otherHomeIds: [betoHome],
    });
    expect(data.matches[0]?.participation).toHaveLength(1);
    expect(data.matches[0]?.participation[0]?.homeId).toBe(anaHome);
    expect(data.consents.map((c) => c.type).sort()).toEqual(['privacy', 'terms']);
    // Nada de los demás usuarios: ni nombres, ni teléfonos, ni emails, ni direcciones
    expect(response.body).not.toContain('Beatriz Ajena');
    expect(response.body).not.toContain('Carla Ajena');
    expect(response.body).not.toContain(BETO_PHONE);
    expect(response.body).not.toContain(beto.email.toLowerCase());
    expect(response.body).not.toContain(beto.id);
    expect(response.body).not.toMatch(/Calle Mayor, \d+, Leganés/);
  });

  it('un seeker sin nada exporta su cuenta y los demás apartados vacíos', async () => {
    const seeker = await scenario.registered('Seeker');

    const response = await exportOf(seeker);

    expect(response.statusCode).toBe(200);
    const data = response.json<Export>();
    expect(data.homes).toEqual([]);
    expect(data.likes).toEqual([]);
    expect(data.dismissals).toEqual([]);
    expect(data.matches).toEqual([]);
    expect(data.searchPreferences).toEqual({ default: null, byHome: [] });
    expect(data.consents).toHaveLength(2);
  });

  it('exige autenticación', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/me/export' });

    expect(response.statusCode).toBe(401);
  });

  it('Scenario: Exportación - como mucho 5 exportaciones por hora y usuario; la sexta recibe 429 con Retry-After', async () => {
    const person = await scenario.registered('Ana');
    const other = await scenario.registered('Otra');

    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await exportOf(person)).statusCode);
    const sixth = await exportOf(person);
    const otherUser = await exportOf(other);

    expect(statuses).toEqual([200, 200, 200, 200, 200]);
    expect(sixth.statusCode).toBe(429);
    expect(Number(sixth.headers['retry-after'])).toBeGreaterThan(0);
    // El límite es por usuario
    expect(otherUser.statusCode).toBe(200);
  });
});
