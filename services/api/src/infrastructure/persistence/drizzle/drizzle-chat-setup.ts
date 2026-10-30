import { asc, eq } from 'drizzle-orm';

import type { ChatRoster, ChatSetup } from '../../../application/chat/chat-setup.js';
import type { Executor } from './database.js';
import { matches, matchParticipants, users } from './schema.js';

/** Lo que PostgreSQL aporta al chat: quién participa (con su uid de Firebase) y el enlace al chat. */
export class DrizzleChatSetup implements ChatSetup {
  constructor(private readonly db: Executor) {}

  async findRoster(matchId: string): Promise<ChatRoster | null> {
    const [match] = await this.db
      .select({ id: matches.id, chatId: matches.chatId })
      .from(matches)
      .where(eq(matches.id, matchId));
    if (!match) return null;
    // Solo el uid, el id y el nombre visible: ni el email ni el teléfono salen de aquí
    const members = await this.db
      .select({
        userId: users.id,
        firebaseUid: users.firebaseUid,
        displayName: users.displayName,
      })
      .from(matchParticipants)
      .innerJoin(users, eq(users.id, matchParticipants.userId))
      .where(eq(matchParticipants.matchId, matchId))
      .orderBy(asc(matchParticipants.homeId));
    return { matchId: match.id, chatId: match.chatId, members };
  }

  async linkChat(matchId: string, chatId: string): Promise<void> {
    await this.db.update(matches).set({ chatId }).where(eq(matches.id, matchId));
  }
}
