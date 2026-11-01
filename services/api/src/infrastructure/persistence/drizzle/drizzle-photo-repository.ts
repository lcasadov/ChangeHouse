import { and, asc, count, eq, inArray } from 'drizzle-orm';

import type { PhotoRepository } from '../../../application/home/photo-repository.js';
import { firstFreePosition, type HomePhoto } from '../../../domain/home/photo.js';
import type { Database } from './database.js';
import { homePhotos, homes } from './schema.js';

type PhotoRow = typeof homePhotos.$inferSelect;

function toPhoto(row: PhotoRow): HomePhoto {
  return {
    id: row.id,
    homeId: row.homeId,
    status: row.status,
    storagePath: row.storagePath,
    position: row.position,
    createdAt: row.createdAt,
  };
}

export class DrizzlePhotoRepository implements PhotoRepository {
  constructor(private readonly db: Database) {}

  async insertPending(photo: HomePhoto): Promise<void> {
    await this.db.insert(homePhotos).values({
      id: photo.id,
      homeId: photo.homeId,
      status: 'pending',
      storagePath: photo.storagePath,
      position: null,
      createdAt: photo.createdAt,
    });
  }

  async find(homeId: string, photoId: string): Promise<HomePhoto | null> {
    const [row] = await this.db
      .select()
      .from(homePhotos)
      .where(and(eq(homePhotos.homeId, homeId), eq(homePhotos.id, photoId)))
      .limit(1);
    return row ? toPhoto(row) : null;
  }

  listReady(homeId: string): Promise<HomePhoto[]> {
    return this.listReadyByHomes([homeId]);
  }

  async listReadyByHomes(homeIds: readonly string[]): Promise<HomePhoto[]> {
    if (homeIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(homePhotos)
      .where(and(inArray(homePhotos.homeId, [...homeIds]), eq(homePhotos.status, 'ready')))
      .orderBy(asc(homePhotos.homeId), asc(homePhotos.position));
    return rows.map(toPhoto);
  }

  async countReady(homeId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(homePhotos)
      .where(and(eq(homePhotos.homeId, homeId), eq(homePhotos.status, 'ready')));
    return row?.total ?? 0;
  }

  async countPending(homeId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(homePhotos)
      .where(and(eq(homePhotos.homeId, homeId), eq(homePhotos.status, 'pending')));
    return row?.total ?? 0;
  }

  /** Bloquea la fila de la vivienda para que las confirmaciones simultáneas se turnen. */
  markReady(homeId: string, photoId: string): Promise<HomePhoto | null> {
    return this.db.transaction(async (tx) => {
      await tx.select({ id: homes.id }).from(homes).where(eq(homes.id, homeId)).for('update');
      const rows = await tx.select().from(homePhotos).where(eq(homePhotos.homeId, homeId));
      const current = rows.find((row) => row.id === photoId);
      if (!current) throw new Error(`Foto inexistente: ${photoId}`);
      if (current.status === 'ready') return toPhoto(current);

      const taken = rows.flatMap((row) =>
        row.status === 'ready' && row.position !== null ? [row.position] : [],
      );
      const position = firstFreePosition(taken);
      if (position === null) return null;
      const [updated] = await tx
        .update(homePhotos)
        .set({ status: 'ready', position })
        .where(eq(homePhotos.id, photoId))
        .returning();
      return updated ? toPhoto(updated) : null;
    });
  }

  async delete(homeId: string, photoId: string): Promise<void> {
    await this.db
      .delete(homePhotos)
      .where(and(eq(homePhotos.homeId, homeId), eq(homePhotos.id, photoId)));
  }
}
