import type { WaitlistRepository } from '../../../application/waitlist/waitlist-repository.js';
import type { WaitlistEntry } from '../../../domain/waitlist/waitlist-entry.js';
import type { Database } from './database.js';
import { waitlist } from './schema.js';

export class DrizzleWaitlistRepository implements WaitlistRepository {
  constructor(private readonly db: Database) {}

  async add(entry: WaitlistEntry): Promise<void> {
    // Un solo paso atómico: dos altas simultáneas del mismo email no compiten ni fallan
    await this.db.insert(waitlist).values(entry).onConflictDoNothing({ target: waitlist.email });
  }
}
