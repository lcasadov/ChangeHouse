import { defineConfig } from 'drizzle-kit';

// Las migraciones se generan con `drizzle-kit generate` (nunca `push`) y se versionan en db/migrations
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/persistence/drizzle/schema.ts',
  out: '../../db/migrations',
});
