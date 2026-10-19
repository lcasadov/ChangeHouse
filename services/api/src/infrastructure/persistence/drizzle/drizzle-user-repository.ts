import { and, asc, eq } from 'drizzle-orm';

import type { ConsentRepository } from '../../../application/account/consent-repository.js';
import type {
  ProfileChanges,
  UserRepository,
} from '../../../application/account/user-repository.js';
import type { Consent } from '../../../domain/account/consent.js';
import type { User } from '../../../domain/account/user.js';
import type { Database } from './database.js';
import { consents, users } from './schema.js';

type UserRow = typeof users.$inferSelect;
type ConsentRow = typeof consents.$inferSelect;

function toUser(row: UserRow): User {
  return { ...row };
}

function toConsent(row: ConsentRow): Consent {
  return { type: row.type, version: row.version, acceptedAt: row.acceptedAt };
}

function required(user: User | null, id: string): User {
  if (!user) throw new Error(`Usuario inexistente: ${id}`);
  return user;
}

export class DrizzleUserRepository implements UserRepository, ConsentRepository {
  constructor(private readonly db: Database) {}

  async findByFirebaseUid(uid: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.firebaseUid, uid)).limit(1);
    return row ? toUser(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? toUser(row) : null;
  }

  async insertWithConsents(user: User, initial: readonly Consent[]): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      // Un solo paso atómico: dos altas simultáneas de la misma identidad no compiten ni fallan
      const inserted = await tx
        .insert(users)
        .values(user)
        .onConflictDoNothing()
        .returning({ id: users.id });
      if (inserted.length === 0) return false;
      if (initial.length > 0) {
        await tx
          .insert(consents)
          .values(initial.map((consent) => ({ ...consent, userId: user.id })));
      }
      return true;
    });
  }

  async update(id: string, changes: ProfileChanges): Promise<User> {
    // Sin campos que cambiar, Drizzle no genera un UPDATE válido: basta con leer
    if (Object.keys(changes).length === 0) return required(await this.findById(id), id);
    const [row] = await this.db.update(users).set(changes).where(eq(users.id, id)).returning();
    return required(row ? toUser(row) : null, id);
  }

  async listByUser(userId: string): Promise<Consent[]> {
    const rows = await this.db
      .select()
      .from(consents)
      .where(eq(consents.userId, userId))
      .orderBy(asc(consents.acceptedAt), asc(consents.type), asc(consents.version));
    return rows.map(toConsent);
  }

  async add(userId: string, consent: Consent): Promise<Consent> {
    await this.db
      .insert(consents)
      .values({ ...consent, userId })
      .onConflictDoNothing();
    // Si ya existía, conserva la fecha original: el registro es evidencia y no se reescribe
    const [stored] = await this.db
      .select()
      .from(consents)
      .where(
        and(
          eq(consents.userId, userId),
          eq(consents.type, consent.type),
          eq(consents.version, consent.version),
        ),
      )
      .limit(1);
    return stored ? toConsent(stored) : consent;
  }
}
