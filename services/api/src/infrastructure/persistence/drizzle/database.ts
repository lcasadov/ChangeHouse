import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseConnection {
  db: Database;
  close(): Promise<void>;
}

/** Abre el pool de conexiones. La conexión real se establece en la primera consulta. */
export function createDatabase(databaseUrl: string): DatabaseConnection {
  const client = postgres(databaseUrl, { onnotice: () => undefined });
  return {
    db: drizzle(client, { schema }),
    close: () => client.end(),
  };
}
