import type { Role } from '../../domain/account/role.js';
import type { VerifiedIdentity } from './identity-verifier.js';

/** Cuenta de ChangeHouse de quien hace la petición. */
export interface Account {
  readonly userId: string;
  readonly role: Role;
}

/** Quién hace la petición: la identidad verificada y, si ya se dio de alta, su cuenta. */
export interface Principal {
  readonly identity: VerifiedIdentity;
  readonly account: Account | null;
}
