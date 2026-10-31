import { eq, sql } from 'drizzle-orm';

import type { ErasureFollowUp } from '../../../application/account/finish-account-deletion.js';
import type { Executor } from './database.js';
import { homePhotos, homes, matchParticipants } from './schema.js';

/** Lo que queda por limpiar tras eliminar una cuenta, leído de PostgreSQL fuera de la transacción. */
export class DrizzleErasureFollowUp implements ErasureFollowUp {
  constructor(private readonly db: Executor) {}

  photosOf(userId: string) {
    return this.db
      .select({
        homeId: homePhotos.homeId,
        photoId: homePhotos.id,
        status: homePhotos.status,
        storagePath: homePhotos.storagePath,
      })
      .from(homePhotos)
      .innerJoin(homes, eq(homes.id, homePhotos.homeId))
      .where(eq(homes.ownerId, userId));
  }

  async deletePhotoRecords(userId: string): Promise<void> {
    await this.db
      .delete(homePhotos)
      .where(sql`${homePhotos.homeId} IN (SELECT id FROM homes WHERE owner_id = ${userId})`);
  }

  async matchIdsOf(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: matchParticipants.matchId })
      .from(matchParticipants)
      .where(eq(matchParticipants.userId, userId));
    return [...new Set(rows.map((row) => row.id))];
  }
}
