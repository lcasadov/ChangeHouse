import { resolve } from 'node:path';

import { runMigrations } from '../src/infrastructure/persistence/drizzle/migrate.js';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('Falta la variable DATABASE_URL');
}

// Se ejecuta desde services/api (pnpm db:migrate): las migraciones están en la raíz del monorepo
await runMigrations(databaseUrl, resolve(process.cwd(), '../../db/migrations'));
