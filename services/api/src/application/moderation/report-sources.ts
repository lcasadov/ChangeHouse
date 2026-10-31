import type { ImageChatMessage, TextChatMessage } from '../chat/chat-channel.js';

/** Un mensaje de usuario localizado en uno de los chats consultados. */
export interface FoundChatMessage {
  readonly chatId: string;
  readonly message: TextChatMessage | ImageChatMessage;
}

/** Puerto de salida: los chats en los que participa un usuario. */
export interface ChatMemberships {
  chatIdsOf(userId: string): Promise<string[]>;
}

/** Puerto de salida: lectura de un mensaje del chat (Firestore) para guardarlo como evidencia. */
export interface ChatMessageLookup {
  /** El mensaje con ese id en alguno de esos chats; `null` si no está (o es del sistema). */
  findMessage(chatIds: readonly string[], messageId: string): Promise<FoundChatMessage | null>;
}
