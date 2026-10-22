import type { ConsentRepository } from './consent-repository.js';
import { acceptConsent, listMyConsents } from './consents.js';
import { getMe } from './get-me.js';
import { upsertMe, type UpsertMeDeps } from './upsert-me.js';

export interface AccountOperationsDeps extends UpsertMeDeps {
  consents: ConsentRepository;
}

/** Los casos de uso de la cuenta con sus dependencias ya inyectadas, listos para el transporte. */
export function accountOperations(deps: AccountOperationsDeps) {
  return {
    getMe: (userId: string) => getMe(deps, userId),
    upsertMe: (command: Parameters<typeof upsertMe>[1]) => upsertMe(deps, command),
    listMyConsents: (userId: string) => listMyConsents(deps, userId),
    acceptConsent: (userId: string, command: Parameters<typeof acceptConsent>[2]) =>
      acceptConsent(deps, userId, command),
  };
}
