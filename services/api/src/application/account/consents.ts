import type { Consent, ConsentType } from '../../domain/account/consent.js';
import type { Clock } from '../clock.js';
import type { ConsentRepository } from './consent-repository.js';

export interface ConsentDeps {
  consents: ConsentRepository;
  clock: Clock;
}

export interface AcceptConsentCommand {
  type: ConsentType;
  version: string;
}

export function listMyConsents(
  deps: Pick<ConsentDeps, 'consents'>,
  userId: string,
): Promise<Consent[]> {
  return deps.consents.listByUser(userId);
}

/**
 * Registra la aceptación de una versión. Las anteriores se conservan (es evidencia legal) y
 * repetir la misma versión no cambia nada.
 */
export function acceptConsent(
  deps: ConsentDeps,
  userId: string,
  command: AcceptConsentCommand,
): Promise<Consent> {
  return deps.consents.add(userId, { ...command, acceptedAt: deps.clock.now() });
}
