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
  }
}

const IMAGE = 'postgis/postgis:17-3.5'; // la misma que docker-compose.yml
const USER = 'changehouse';
const PASSWORD = 'changehouse';
const PORT = 5432;

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
  return async () => {
    await container.stop();
  };
}
