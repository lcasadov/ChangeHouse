import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/** Aplica las migraciones versionadas de `db/migrations` (generadas con drizzle-kit). */
export async function runMigrations(databaseUrl: string, migrationsFolder: string): Promise<void> {
  // Una sola conexión; se silencian los avisos de «ya existe» de las extensiones
  const connection = postgres(databaseUrl, { max: 1, onnotice: () => undefined });
  try {
    await migrate(drizzle(connection), { migrationsFolder });
  } finally {
    await connection.end();
  }
}
