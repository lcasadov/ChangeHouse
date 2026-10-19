import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';

import { accountOperations } from './application/account/account-operations.js';
import type { HomeOwnership } from './application/account/home-ownership.js';
import { resolvePrincipal } from './application/auth/resolve-principal.js';
import { joinWaitlist } from './application/waitlist/join-waitlist.js';
import type { ApiConfig } from './config.js';
import { noPublishedHomes } from './infrastructure/account/no-published-homes.js';
import { createFirebaseIdentityVerifier } from './infrastructure/auth/firebase-identity-verifier.js';
import { createDatabase } from './infrastructure/persistence/drizzle/database.js';
import { DrizzleUserRepository } from './infrastructure/persistence/drizzle/drizzle-user-repository.js';
import { DrizzleWaitlistRepository } from './infrastructure/persistence/drizzle/drizzle-waitlist-repository.js';
import { systemClock, uuidV7Generator } from './infrastructure/system.js';
import { buildApp } from './interfaces/http/app.js';

/** Adaptadores que se pueden sustituir al componer la API (las pruebas, y los changes que aún no los traen). */
export interface ApiAdapters {
  /** Por defecto, `noPublishedHomes`: `add-home-listing` aporta la consulta real. */
  homeOwnership?: HomeOwnership;
}

/** Raíz de composición: une adaptadores, casos de uso y transporte. */
export function createApi(config: ApiConfig, adapters: ApiAdapters = {}) {
  const database = createDatabase(config.databaseUrl);
  const { verifier, close: closeIdentity } = createFirebaseIdentityVerifier(config.firebase);

  const users = new DrizzleUserRepository(database.db);
  const ownership = adapters.homeOwnership ?? noPublishedHomes;
  const waitlistDeps = {
    repository: new DrizzleWaitlistRepository(database.db),
    clock: systemClock,
    ids: uuidV7Generator,
  };
  const accounts = accountOperations({
    users,
    ownership,
    clock: systemClock,
    ids: uuidV7Generator,
    legalVersions: { terms: TERMS_VERSION, privacy: PRIVACY_VERSION },
    consents: users,
  });

  const app = buildApp({
    logger: config.logger,
    landingOrigin: config.landingOrigin,
    appOrigins: config.appOrigins,
    trustProxyHops: config.trustProxyHops,
    security: {
      authenticate: (token) => resolvePrincipal({ verifier, users, ownership }, token),
    },
    waitlist: {
      joinWaitlist: (command) => joinWaitlist(waitlistDeps, command),
      rateLimit: config.waitlistRateLimit,
    },
    accounts,
  });

  return {
    app,
    close: async () => {
      await app.close();
      await closeIdentity();
      await database.close();
    },
  };
}
