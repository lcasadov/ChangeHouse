import { grantAdmin } from '../src/application/account/admin-grant.js';
import { DomainError } from '../src/domain/domain-error.js';
import { createDatabase } from '../src/infrastructure/persistence/drizzle/database.js';
import { DrizzleAdminGrants } from '../src/infrastructure/persistence/drizzle/drizzle-admin-grants.js';

const USAGE_EXIT = 2;
const FAILURE_EXIT = 1;

const email = process.argv[2];
const databaseUrl = process.env['DATABASE_URL'];
if (!email) {
  process.stderr.write('Uso: pnpm --filter @changehouse/api admin:grant <email>\n');
  process.exit(USAGE_EXIT);
}
if (!databaseUrl) {
  process.stderr.write('Falta la variable DATABASE_URL\n');
  process.exit(USAGE_EXIT);
}

const database = createDatabase(databaseUrl);
let exitCode = 0;
try {
  await grantAdmin(
    {
      grants: new DrizzleAdminGrants(database.db),
      log: (event) => process.stdout.write(`${JSON.stringify(event)}\n`),
    },
    email,
  );
} catch (error) {
  if (!(error instanceof DomainError)) throw error;
  process.stderr.write(`${error.message}\n`);
  exitCode = FAILURE_EXIT;
} finally {
  await database.close();
}
process.exit(exitCode);
