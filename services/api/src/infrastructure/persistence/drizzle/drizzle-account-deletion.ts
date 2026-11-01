import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import type { AccountDeletionStore } from '../../../application/account/account-deletion.js';
import type { User } from '../../../domain/account/user.js';
import type { Executor } from './database.js';
import {
  accountDismissals,
  dismissals,
  homes,
  likes,
  matches,
  matchParticipants,
  searchPreferences,
  userDevices,
  users,
} from './schema.js';

/** Las viviendas del usuario, como subconsulta para borrar lo que cuelga de ellas. */
const ownHomeIds = (userId: string) => sql`(SELECT id FROM homes WHERE owner_id = ${userId})`;

/** La eliminación de la cuenta sobre PostgreSQL; el `Executor` es la transacción en curso. */
export class DrizzleAccountDeletionStore implements AccountDeletionStore {
  constructor(private readonly db: Executor) {}

  async lockUser(userId: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .for('update');
    return row ? { ...row } : null;
  }

  async saveAnonymized(user: User): Promise<void> {
    await this.db
      .update(users)
      .set({
        email: user.email,
        displayName: user.displayName,
        phone: user.phone,
        municipality: user.municipality,
        deletedAt: user.deletedAt,
      })
      .where(eq(users.id, user.id));
  }

  async liveMatchIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: matches.id })
      .from(matches)
      .innerJoin(matchParticipants, eq(matchParticipants.matchId, matches.id))
      .where(
        and(eq(matchParticipants.userId, userId), inArray(matches.status, ['open', 'confirmed'])),
      )
      .orderBy(asc(matches.id));
    return [...new Set(rows.map((row) => row.id))];
  }

  async eraseExactLocation(userId: string): Promise<void> {
    await this.db
      .update(homes)
      .set({ exactAddress: null, exactLocation: null })
      .where(eq(homes.ownerId, userId));
  }

  async eraseDerivedData(userId: string): Promise<void> {
    // Preferencias por defecto y de cada vivienda llevan el `user_id` del propietario
    await this.db.delete(searchPreferences).where(eq(searchPreferences.userId, userId));
    await this.db.delete(userDevices).where(eq(userDevices.userId, userId));
    await this.db.delete(likes).where(sql`${likes.fromHomeId} IN ${ownHomeIds(userId)}`);
    await this.db.delete(dismissals).where(sql`${dismissals.homeId} IN ${ownHomeIds(userId)}`);
    await this.db.delete(accountDismissals).where(eq(accountDismissals.userId, userId));
  }
}
