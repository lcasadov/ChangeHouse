import type { BlockRepository } from '../../../application/moderation/block-repository.js';
import type { Executor } from './database.js';
import { userBlocks } from './schema.js';

/** Bloqueos en PostgreSQL; bloquear de nuevo a quien ya se bloqueó no cambia nada. */
export class DrizzleBlockRepository implements BlockRepository {
  constructor(private readonly db: Executor) {}

  async add(blockerId: string, blockedId: string, at: Date): Promise<void> {
    await this.db
      .insert(userBlocks)
      .values({ blockerId, blockedId, createdAt: at })
      .onConflictDoNothing();
  }
}
