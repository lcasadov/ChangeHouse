import { and, eq, isNotNull } from 'drizzle-orm';

import type { ChatMemberships } from '../../../application/moderation/report-sources.js';
import type { Executor } from './database.js';
import { matches, matchParticipants } from './schema.js';

/** Los chats de los matches en los que participa un usuario, tenga el match el estado que tenga. */
export class DrizzleChatMemberships implements ChatMemberships {
  constructor(private readonly db: Executor) {}

  async chatIdsOf(userId: string): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ chatId: matches.chatId })
      .from(matchParticipants)
      .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
      .where(and(eq(matchParticipants.userId, userId), isNotNull(matches.chatId)));
    return rows.flatMap((row) => (row.chatId === null ? [] : [row.chatId]));
  }
}
