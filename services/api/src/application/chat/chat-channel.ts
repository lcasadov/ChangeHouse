/** Mensaje de un participante: su id interno y su nombre visible, nunca su email ni su teléfono. */
export interface TextChatMessage {
  readonly id: string;
  readonly kind: 'text';
  readonly senderId: string;
  readonly senderName: string;
  readonly text: string;
  readonly createdAt: Date;
}

/** Imagen ya procesada: su id es opaco y `getChatImageUrl` lo cambia por una URL firmada. */
export interface ImageChatMessage {
  readonly id: string;
  readonly kind: 'image';
  readonly senderId: string;
  readonly senderName: string;
  readonly imageId: string;
  readonly createdAt: Date;
}

/** Mensaje del sistema que presenta a los participantes al abrirse el chat. */
export interface SystemChatMessage {
  readonly id: string;
  readonly kind: 'system';
  readonly event: 'welcome';
  readonly participantNames: readonly string[];
  readonly createdAt: Date;
}

export type ChatMessageRecord = TextChatMessage | ImageChatMessage | SystemChatMessage;

export interface NewChat {
  readonly chatId: string;
  readonly matchId: string;
  /** `firebase_uid` de los participantes: es lo que conocen las reglas de Firestore. */
  readonly participantUids: readonly string[];
  readonly welcome: SystemChatMessage;
  readonly createdAt: Date;
}

/** Cómo se presenta en un chat una cuenta eliminada: el remitente renombrado y los nombres de la bienvenida. */
export interface ParticipantAnonymization {
  /** Id interno del usuario eliminado, tal como figura en `senderId` de sus mensajes. */
  readonly senderId: string;
  readonly displayName: string;
  /** Nombres actuales de todos los participantes, en el orden del mensaje de bienvenida. */
  readonly participantNames: readonly string[];
}

/** Puerto de salida: el almacén del chat en tiempo real (Firestore). Solo la API escribe en él. */
export interface ChatChannel {
  /** Crea el chat con su mensaje de bienvenida; si ya existe no hace nada (idempotente). */
  createChat(chat: NewChat): Promise<void>;
  appendMessage(chatId: string, message: ChatMessageRecord): Promise<void>;
  /**
   * Conserva los mensajes pero sustituye el nombre de quien eliminó su cuenta. Es idempotente y un
   * chat que no existe no es un error.
   */
  anonymizeParticipant(chatId: string, anonymization: ParticipantAnonymization): Promise<void>;
  /**
   * Borra todos los mensajes del chat (retención a los 12 meses del cierre) y conserva el chat. Es
   * idempotente y un chat que no existe no es un error.
   */
  purgeMessages(chatId: string): Promise<void>;
}
