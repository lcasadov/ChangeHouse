import { createWaitlistEntry, type HomeType } from '../../domain/waitlist/waitlist-entry.js';
import type { Clock } from '../clock.js';
import type { IdGenerator } from '../id-generator.js';
import type { WaitlistRepository } from './waitlist-repository.js';

export interface JoinWaitlistDeps {
  repository: WaitlistRepository;
  clock: Clock;
  ids: IdGenerator;
}

export interface JoinWaitlistCommand {
  email: string;
  municipality: string;
  homeType: HomeType;
  lookingFor: string;
  consent: true;
}

export interface JoinWaitlistResult {
  accepted: true;
}

/**
 * Da de alta a un visitante. El resultado es el mismo si el email ya estaba inscrito:
 * no se revela quién está en la lista.
 */
export async function joinWaitlist(
  deps: JoinWaitlistDeps,
  command: JoinWaitlistCommand,
): Promise<JoinWaitlistResult> {
  const entry = createWaitlistEntry({
    ...command,
    id: deps.ids.next(),
    consentAt: deps.clock.now(),
  });
  await deps.repository.add(entry);
  return { accepted: true };
}
