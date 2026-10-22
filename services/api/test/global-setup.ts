import { createServer } from 'node:net';
import { resolve } from 'node:path';

import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import type { TestProject } from 'vitest/node';

import { runMigrations } from '../src/infrastructure/persistence/drizzle/migrate.js';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Base de datos con las migraciones reales ya aplicadas. */
    databaseUrl: string;
    /** Servidor PostgreSQL con permisos para crear bases vacías. */
    adminUrl: string;
    /** `host:puerto` del emulador de Firebase Auth, o cadena vacía si no está disponible en local. */
    authEmulatorHost: string;
    /** `host:puerto` de fake-gcs-server (Cloud Storage simulado) con los buckets de las fotos ya creados. */
    storageEmulatorHost: string;
  }
}

const IMAGE = 'postgis/postgis:17-3.5'; // la misma que docker-compose.yml
const STORAGE_IMAGE = 'fsouza/fake-gcs-server:1.56.1'; // la misma que docker-compose.yml
const STORAGE_PORT = 4443;
export const PHOTO_BUCKETS = ['changehouse-photos-private', 'changehouse-photos-public'] as const;
const USER = 'changehouse';
const PASSWORD = 'changehouse';
const PORT = 5432;

const DEFAULT_AUTH_EMULATOR_HOST = 'localhost:9099';
const PROBE_TIMEOUT_MS = 2000;

async function isReachable(host: string): Promise<boolean> {
  try {
    const response = await fetch(`http://${host}/`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Localiza el emulador de Auth. En local, si no está arrancado, las pruebas que lo necesitan se
 * omiten con un aviso; en la CI su ausencia es un error: nunca se da por buena una ejecución sin él.
 */
async function locateAuthEmulator(): Promise<string> {
  const host = process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? DEFAULT_AUTH_EMULATOR_HOST;
  if (await isReachable(host)) return host;
  if (process.env['CI']) throw new Error(`El emulador de Firebase Auth no responde en ${host}`);
  process.stderr.write(
    `\n[integración] El emulador de Firebase Auth no responde en ${host}: se OMITEN las pruebas que lo necesitan.\n` +
      '  Ejecuta `pnpm test:integration` desde la raíz (lo arranca) o `pnpm emulators` en otra terminal.\n\n',
  );
  return '';
}

/** Un puerto libre del equipo: fake-gcs-server solo atiende las URL firmadas si se le dice el host:puerto público. */
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as { port: number };
  await new Promise((done) => server.close(done));
  return port;
}

/** Arranca fake-gcs-server (en memoria) con los buckets de las fotos y devuelve su `host:puerto`. */
async function startStorage(): Promise<{ container: StartedTestContainer; host: string }> {
  const port = await freePort();
  const host = `127.0.0.1:${String(port)}`;
  const container = await new GenericContainer(STORAGE_IMAGE)
    .withCommand([
      '-scheme',
      'http',
      '-port',
      String(STORAGE_PORT),
      '-backend',
      'memory',
      '-public-host',
      host,
    ])
    .withExposedPorts({ container: STORAGE_PORT, host: port })
    .withWaitStrategy(Wait.forLogMessage(/server started at/))
    .start();
  for (const name of PHOTO_BUCKETS) {
    const response = await fetch(`http://${host}/storage/v1/b`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok)
      throw new Error(`No se pudo crear el bucket ${name}: ${String(response.status)}`);
  }
  return { container, host };
}

/** Arranca un PostgreSQL + PostGIS real (nunca una base en memoria) y le aplica las migraciones. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container: StartedTestContainer = await new GenericContainer(IMAGE)
    .withEnvironment({ POSTGRES_USER: USER, POSTGRES_PASSWORD: PASSWORD, POSTGRES_DB: 'postgres' })
    .withExposedPorts(PORT)
    // PostgreSQL arranca dos veces (inicialización y servicio): hay que esperar a la segunda
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();

  const host = container.getHost();
  const port = String(container.getMappedPort(PORT));
  const databaseUrl = `postgres://${USER}:${PASSWORD}@${host}:${port}/postgres`;
  await runMigrations(databaseUrl, resolve(import.meta.dirname, '../../../db/migrations'));

  project.provide('databaseUrl', databaseUrl);
  project.provide('adminUrl', databaseUrl);
  project.provide('authEmulatorHost', await locateAuthEmulator());
  const storage = await startStorage();
  project.provide('storageEmulatorHost', storage.host);
  return async () => {
    await storage.container.stop();
    await container.stop();
  };
}
