import { deleteApp, initializeApp } from 'firebase-admin/app';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';

import type {
  ChatChannel,
  ChatMessageRecord,
  NewChat,
} from '../../application/chat/chat-channel.js';

/** Código gRPC `ALREADY_EXISTS`: el documento que se intenta crear ya existe. */
const ALREADY_EXISTS = 6;

function isAlreadyExists(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === ALREADY_EXISTS;
}

/** El documento de Firestore de un mensaje, campo a campo: nada que no se nombre aquí se publica. */
function documentOf(message: ChatMessageRecord): Record<string, unknown> {
  switch (message.kind) {
    case 'text':
      return {
        kind: 'text',
        senderId: message.senderId,
        senderName: message.senderName,
        text: message.text,
        createdAt: message.createdAt,
      };
    case 'image':
      return {
        kind: 'image',
        senderId: message.senderId,
        senderName: message.senderName,
        imageId: message.imageId,
        createdAt: message.createdAt,
      };
    case 'system':
      return {
        kind: 'system',
        event: message.event,
        participantNames: [...message.participantNames],
        createdAt: message.createdAt,
      };
  }
}

/**
 * Adaptador de `ChatChannel` sobre Cloud Firestore con `firebase-admin`: `chats/{chatId}` con los
 * `participantUids` que leen las reglas, y `chats/{chatId}/messages/{messageId}`. Las escrituras de
 * la API no pasan por las reglas; los clientes solo leen.
 */
export class FirestoreChatChannel implements ChatChannel {
  constructor(private readonly firestore: Firestore) {}

  async createChat(chat: NewChat): Promise<void> {
    const chatRef = this.firestore.collection('chats').doc(chat.chatId);
    const batch = this.firestore.batch();
    batch.create(chatRef, {
      matchId: chat.matchId,
      participantUids: [...chat.participantUids],
      createdAt: chat.createdAt,
    });
    batch.create(chatRef.collection('messages').doc(chat.welcome.id), documentOf(chat.welcome));
    try {
      await batch.commit();
    } catch (error) {
      // El lote es atómico: si el chat ya existe, también tiene su mensaje de bienvenida
      if (!isAlreadyExists(error)) throw error;
    }
  }

  async appendMessage(chatId: string, message: ChatMessageRecord): Promise<void> {
    const chatRef = this.firestore.collection('chats').doc(chatId);
    await this.firestore.runTransaction(async (transaction) => {
      const chat = await transaction.get(chatRef);
      if (!chat.exists) throw new Error(`El chat ${chatId} no existe en Firestore`);
      transaction.create(chatRef.collection('messages').doc(message.id), documentOf(message));
    });
  }
}

export interface FirestoreChatOptions {
  projectId: string;
  /** `host:puerto` del emulador de Firestore. Solo en local y en las pruebas. */
  firestoreEmulatorHost?: string | undefined;
}

let instances = 0;

/** Crea el canal con su propia aplicación de Firebase; `close` la libera. */
export function createFirestoreChatChannel(options: FirestoreChatOptions) {
  // El SDK solo lee el emulador de esta variable de entorno, y lo hace al crear `Firestore`
  if (options.firestoreEmulatorHost) {
    process.env['FIRESTORE_EMULATOR_HOST'] = options.firestoreEmulatorHost;
  }
  instances += 1;
  const app = initializeApp(
    { projectId: options.projectId },
    `changehouse-chat-${String(instances)}`,
  );
  return {
    channel: new FirestoreChatChannel(getFirestore(app)),
    close: () => deleteApp(app),
  };
}
