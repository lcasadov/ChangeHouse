import { and, eq, ne } from 'drizzle-orm';

import type { AdminGrantRepository } from '../../../application/account/admin-grant.js';
import type { User } from '../../../domain/account/user.js';
import type { Database } from './database.js';
import { homes, users } from './schema.js';

/** Concesión del rol `admin` en PostgreSQL. El email es `citext`: la búsqueda no distingue mayúsculas. */
export class DrizzleAdminGrants implements AdminGrantRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ?? null;
  }

  async hasActiveHomes(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: homes.id })
      .from(homes)
      .where(and(eq(homes.ownerId, userId), ne(homes.status, 'closed')))
      .limit(1);
    return row !== undefined;
  }

  async assignAdmin(userId: string): Promise<void> {
    await this.db.update(users).set({ assignedRole: 'admin' }).where(eq(users.id, userId));
  }
}
