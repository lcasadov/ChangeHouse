import {
  type Consent,
  LegalAcceptanceRequiredError,
  type LegalVersions,
  missingLegalAcceptance,
} from '../../domain/account/consent.js';
import type { User } from '../../domain/account/user.js';
import type { VerifiedIdentity } from '../auth/identity-verifier.js';
import type { Clock } from '../clock.js';
import type { IdGenerator } from '../id-generator.js';
import { EmailAlreadyRegisteredError, IdentityEmailRequiredError } from './errors.js';
import type { HomeOwnership } from './home-ownership.js';
import { buildMe, type Me } from './me.js';
import type { ProfileChanges, UserRepository } from './user-repository.js';

export interface UpsertMeDeps {
  users: UserRepository;
  ownership: HomeOwnership;
  clock: Clock;
  ids: IdGenerator;
  /** Versiones vigentes de los textos legales, que el primer acceso debe haber aceptado. */
  legalVersions: LegalVersions;
}

export interface UpsertMeInput {
  displayName: string;
  municipality?: string | undefined;
  phone?: string | undefined;
  meetsVppRequirements?: boolean | undefined;
  isOver65?: boolean | undefined;
  acceptedTermsVersion?: string | undefined;
  acceptedPrivacyVersion?: string | undefined;
}

export interface UpsertMeCommand {
  /** Identidad ya verificada: el email del alta sale de aquí, nunca de la petición. */
  identity: VerifiedIdentity;
  input: UpsertMeInput;
}

export interface UpsertMeResult {
  created: boolean;
  me: Me;
}

/** Un municipio en blanco es un municipio borrado: se guarda como ausente, no como cadena vacía. */
function municipalityOf(municipality: string): string | null {
  return municipality === '' ? null : municipality;
}

/** Solo los campos que el cliente envió: lo omitido no se toca. */
function profileChanges(input: UpsertMeInput): ProfileChanges {
  const changes: ProfileChanges = { displayName: input.displayName };
  if (input.municipality !== undefined) changes.municipality = municipalityOf(input.municipality);
  if (input.phone !== undefined) changes.phone = input.phone;
  if (input.meetsVppRequirements !== undefined) {
    changes.meetsVppRequirements = input.meetsVppRequirements;
  }
  if (input.isOver65 !== undefined) changes.isOver65 = input.isOver65;
  return changes;
}

function newUser(deps: UpsertMeDeps, command: UpsertMeCommand, email: string): User {
  const { input } = command;
  return {
    id: deps.ids.next(),
    firebaseUid: command.identity.uid,
    email: email.trim().toLowerCase(),
    displayName: input.displayName,
    phone: input.phone ?? null,
    municipality: municipalityOf(input.municipality ?? ''),
    meetsVppRequirements: input.meetsVppRequirements ?? false,
    isOver65: input.isOver65 ?? false,
    assignedRole: null,
    createdAt: deps.clock.now(),
  };
}

/** Todo se valida antes de guardar nada: sin las versiones vigentes no hay alta (RF-04). */
function initialConsents(deps: UpsertMeDeps, input: UpsertMeInput): Consent[] {
  const missing = missingLegalAcceptance(
    { terms: input.acceptedTermsVersion, privacy: input.acceptedPrivacyVersion },
    deps.legalVersions,
  );
  if (missing.length > 0) throw new LegalAcceptanceRequiredError(missing);
  const acceptedAt = deps.clock.now();
  return [
    { type: 'terms', version: deps.legalVersions.terms, acceptedAt },
    { type: 'privacy', version: deps.legalVersions.privacy, acceptedAt },
  ];
}

/** Da de alta al usuario; devuelve `null` si otro acceso simultáneo ya lo había creado. */
async function register(deps: UpsertMeDeps, command: UpsertMeCommand): Promise<User | null> {
  const consents = initialConsents(deps, command.input);
  const email = command.identity.email;
  if (!email) throw new IdentityEmailRequiredError();

  const user = newUser(deps, command, email);
  const inserted = await deps.users.insertWithConsents(user, consents);
  return inserted ? user : null;
}

/**
 * Alta o actualización de la propia cuenta, idempotente. El primer acceso exige aceptar las
 * versiones vigentes de términos y privacidad y las registra; los siguientes solo actualizan los
 * datos enviados.
 */
export async function upsertMe(
  deps: UpsertMeDeps,
  command: UpsertMeCommand,
): Promise<UpsertMeResult> {
  const existing = await deps.users.findByFirebaseUid(command.identity.uid);
  if (!existing) {
    const created = await register(deps, command);
    if (created) return { created: true, me: await buildMe(deps.ownership, created) };
  }

  // Ya existía, o un acceso simultáneo de la misma persona se adelantó: se actualiza ese usuario
  const current = existing ?? (await deps.users.findByFirebaseUid(command.identity.uid));
  // Sin usuario con su UID, quien ocupa el email es otra identidad
  if (!current) throw new EmailAlreadyRegisteredError();
  const updated = await deps.users.update(current.id, profileChanges(command.input));
  return { created: false, me: await buildMe(deps.ownership, updated) };
}
