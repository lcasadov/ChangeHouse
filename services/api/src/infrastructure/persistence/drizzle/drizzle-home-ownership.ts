import { and, eq, inArray } from 'drizzle-orm';

import type { HomeOwnership } from '../../../application/account/home-ownership.js';
import type { Database } from './database.js';
import { homes } from './schema.js';

/** Estados que hacen propietario a su dueño (`docs/rbac-matrix.md` §1). */
const OWNING_STATUSES = ['published', 'paused', 'in_operation'] as const;

/** El rol `owner` se deriva de las viviendas: existe alguna propia publicada, pausada o en operación. */
export class DrizzleHomeOwnership implements HomeOwnership {
  constructor(private readonly db: Database) {}

  async hasPublishedHome(userId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: homes.id })
      .from(homes)
      .where(and(eq(homes.ownerId, userId), inArray(homes.status, OWNING_STATUSES)))
      .limit(1);
    return rows.length > 0;
  }
}
