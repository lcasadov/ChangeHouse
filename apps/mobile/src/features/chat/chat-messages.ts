/** Mensaje de un participante: su id interno y su nombre visible; nunca su email ni su teléfono. */
export interface TextChatMessage {
  id: string;
  kind: 'text';
  senderId: string;
  senderName: string;
  text: string;
  createdAt: Date;
}

/** Imagen de un participante: lleva un `imageId` opaco que `getChatImageUrl` cambia por una URL firmada. */
export interface ImageChatMessage {
  id: string;
  kind: 'image';
  senderId: string;
  senderName: string;
  imageId: string;
  createdAt: Date;
}

/** Mensaje del sistema que presenta a los participantes al abrirse el chat. */
export interface SystemChatMessage {
  id: string;
  kind: 'system';
  event: 'welcome';
  participantNames: string[];
  createdAt: Date;
}

export type ChatMessage = TextChatMessage | ImageChatMessage | SystemChatMessage;

export interface ChatMessagesListener {
  /** Todos los mensajes del chat, del más antiguo al más reciente; se llama en cada cambio. */
  onMessages: (messages: ChatMessage[]) => void;
  /** El canal ha fallado (sin permiso o sin conexión) y no entregará más mensajes. */
  onError: () => void;
}

/**
 * Puerto de entrada del chat en tiempo real: los mensajes se leen directamente del almacén
 * (Firestore) y nunca se escriben desde aquí, todo envío pasa por la API (`ChatApi`).
 */
export interface ChatMessages {
  /** Empieza a escuchar el chat; devuelve la función que deja de escuchar. */
  subscribe: (chatId: string, listener: ChatMessagesListener) => () => void;
}
