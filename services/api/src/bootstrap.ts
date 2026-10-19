import { joinWaitlist } from './application/waitlist/join-waitlist.js';
import type { ApiConfig } from './config.js';
import { createDatabase } from './infrastructure/persistence/drizzle/database.js';
import { DrizzleWaitlistRepository } from './infrastructure/persistence/drizzle/drizzle-waitlist-repository.js';
import { systemClock, uuidV7Generator } from './infrastructure/system.js';
import { buildApp } from './interfaces/http/app.js';

/** Raíz de composición: une adaptadores, casos de uso y transporte. */
export function createApi(config: ApiConfig) {
  const database = createDatabase(config.databaseUrl);
  const deps = {
    repository: new DrizzleWaitlistRepository(database.db),
    clock: systemClock,
    ids: uuidV7Generator,
  };

  const app = buildApp({
    logger: config.logger,
    landingOrigin: config.landingOrigin,
    trustProxyHops: config.trustProxyHops,
    waitlist: {
      joinWaitlist: (command) => joinWaitlist(deps, command),
      rateLimit: config.waitlistRateLimit,
    },
  });

  return {
    app,
    close: async () => {
      await app.close();
      await database.close();
    },
  };
}
