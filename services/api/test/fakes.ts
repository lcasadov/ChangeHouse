import type { ConsentRepository } from '../src/application/account/consent-repository.js';
import type { HomeOwnership } from '../src/application/account/home-ownership.js';
import type { ProfileChanges, UserRepository } from '../src/application/account/user-repository.js';
import type { Consent } from '../src/domain/account/consent.js';
import type { User } from '../src/domain/account/user.js';

const DEFAULT_CREATED_AT = new Date('2026-10-01T09:00:00.000Z');

/** Usuario completo con valores por defecto; cada prueba cambia solo lo que le importa. */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    firebaseUid: 'uid-1',
    email: 'ana@example.com',
    displayName: 'Ana',
    phone: null,
    municipality: null,
    meetsVppRequirements: false,
    isOver65: false,
    assignedRole: null,
    createdAt: DEFAULT_CREATED_AT,
    ...overrides,
  };
}

/** Almacén en memoria de usuarios y consentimientos; reproduce la unicidad de uid y email. */
export class InMemoryUserRepository implements UserRepository, ConsentRepository {
  readonly users = new Map<string, User>();
  readonly consents: { userId: string; consent: Consent }[] = [];

  constructor(initial: readonly User[] = []) {
    for (const user of initial) this.users.set(user.id, user);
  }

  findByFirebaseUid(uid: string): Promise<User | null> {
    return Promise.resolve(
      [...this.users.values()].find((user) => user.firebaseUid === uid) ?? null,
    );
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  insertWithConsents(user: User, consents: readonly Consent[]): Promise<boolean> {
    const taken = [...this.users.values()].some(
      (other) =>
        other.firebaseUid === user.firebaseUid ||
        other.email.toLowerCase() === user.email.toLowerCase(),
    );
    if (taken) return Promise.resolve(false);
    this.users.set(user.id, user);
    for (const consent of consents) this.consents.push({ userId: user.id, consent });
    return Promise.resolve(true);
  }

  update(id: string, changes: ProfileChanges): Promise<User> {
    const current = this.users.get(id);
    if (!current) return Promise.reject(new Error(`Usuario inexistente: ${id}`));
    const updated = { ...current, ...changes };
    this.users.set(id, updated);
    return Promise.resolve(updated);
  }

  listByUser(userId: string): Promise<Consent[]> {
    return Promise.resolve(
      this.consents.filter((entry) => entry.userId === userId).map((entry) => entry.consent),
    );
  }

  add(userId: string, consent: Consent): Promise<Consent> {
    const existing = this.consents.find(
      (entry) =>
        entry.userId === userId &&
        entry.consent.type === consent.type &&
        entry.consent.version === consent.version,
    );
    if (existing) return Promise.resolve(existing.consent);
    this.consents.push({ userId, consent });
    return Promise.resolve(consent);
  }
}

/** Puerto de viviendas con un conjunto fijo de propietarios. */
export class FixedHomeOwnership implements HomeOwnership {
  constructor(readonly owners = new Set<string>()) {}

  hasPublishedHome(userId: string): Promise<boolean> {
    return Promise.resolve(this.owners.has(userId));
  }
}
