import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { openSql } from '../../../../test/fixtures.js';
import { createDatabase, type DatabaseConnection } from './database.js';
import { DrizzleDeviceRepository } from './drizzle-device-repository.js';

const sql = openSql();
const AT = new Date('2026-10-20T09:00:00.000Z');
const LATER = new Date('2026-10-21T09:00:00.000Z');
const ANA = '0199c1a2-0000-7000-8000-0000000000a1';
const BETO = '0199c1a2-0000-7000-8000-0000000000b1';

let connection: DatabaseConnection;
let devices: DrizzleDeviceRepository;

beforeAll(() => {
  connection = createDatabase(inject('databaseUrl'));
  devices = new DrizzleDeviceRepository(connection.db);
});

beforeEach(async () => {
  await sql`TRUNCATE users CASCADE`;
  for (const [id, name] of [
    [ANA, 'Ana'],
    [BETO, 'Beto'],
  ] as const) {
    await sql`INSERT INTO users (id, firebase_uid, email, display_name)
              VALUES (${id}, ${`uid-${name}`}, ${`${name}@example.com`}, ${name})`;
  }
});

afterAll(async () => {
  await connection.close();
  await sql.end();
});

const rows = () =>
  sql<{ fcm_token: string; user_id: string; platform: string; updated_at: Date }[]>`
    SELECT fcm_token, user_id, platform, updated_at FROM user_devices ORDER BY fcm_token`;

describe('DrizzleDeviceRepository.upsert', () => {
  it('Scenario: el mismo token dos veces - queda una sola fila, con la plataforma y la fecha de la última', async () => {
    await devices.upsert({ fcmToken: 'tok-1', userId: ANA, platform: 'android', at: AT });
    await devices.upsert({ fcmToken: 'tok-1', userId: ANA, platform: 'ios', at: LATER });

    expect(await rows()).toEqual([
      { fcm_token: 'tok-1', user_id: ANA, platform: 'ios', updated_at: LATER },
    ]);
  });

  it('un token que ahora usa otra cuenta pasa a ella: el dispositivo ya no avisa a la anterior', async () => {
    await devices.upsert({ fcmToken: 'tok-1', userId: ANA, platform: 'web', at: AT });
    await devices.upsert({ fcmToken: 'tok-1', userId: BETO, platform: 'web', at: LATER });

    expect((await rows()).map((row) => row.user_id)).toEqual([BETO]);
  });
});

describe('DrizzleDeviceRepository.tokensOf y deleteTokens', () => {
  it('devuelve los tokens de las cuentas pedidas y ninguno de las demás; sin cuentas, nada', async () => {
    await devices.upsert({ fcmToken: 'tok-a', userId: ANA, platform: 'android', at: AT });
    await devices.upsert({ fcmToken: 'tok-b', userId: BETO, platform: 'ios', at: AT });

    expect(await devices.tokensOf([ANA])).toEqual(['tok-a']);
    expect((await devices.tokensOf([ANA, BETO])).sort()).toEqual(['tok-a', 'tok-b']);
    expect(await devices.tokensOf([])).toEqual([]);
  });

  it('borra los tokens indicados, ignora los desconocidos y no toca los demás', async () => {
    await devices.upsert({ fcmToken: 'tok-a', userId: ANA, platform: 'android', at: AT });
    await devices.upsert({ fcmToken: 'tok-b', userId: ANA, platform: 'android', at: AT });

    await devices.deleteTokens(['tok-a', 'tok-inexistente']);
    await devices.deleteTokens([]);

    expect((await rows()).map((row) => row.fcm_token)).toEqual(['tok-b']);
  });
});
