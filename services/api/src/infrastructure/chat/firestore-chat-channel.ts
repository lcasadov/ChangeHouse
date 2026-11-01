import { deleteApp, initializeApp } from 'firebase-admin/app';
import {
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  getFirestore,
} from 'firebase-admin/firestore';

import type {
  ChatChannel,
  ChatMessageRecord,
  NewChat,
  ParticipantAnonymization,
} from '../../application/chat/chat-channel.js';
import type {
  ChatMessageLookup,
  FoundChatMessage,
} from '../../application/moderation/report-sources.js';

/** Escrituras que admite un lote de Firestore, con margen sobre el máximo de 500. */
const BATCH_LIMIT = 400;

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

/** Un mensaje de usuario leído de su documento; `null` si es del sistema o no tiene la forma esperada. */
function userMessageOf(document: DocumentSnapshot): FoundChatMessage['message'] | null {
  const data = document.data();
  const createdAt = (data?.['createdAt'] as { toDate?: () => Date } | undefined)?.toDate?.();
  const senderId: unknown = data?.['senderId'];
  const senderName: unknown = data?.['senderName'];
  if (typeof senderId !== 'string' || typeof senderName !== 'string' || !createdAt) return null;
  const common = { id: document.id, senderId, senderName, createdAt };
  if (data?.['kind'] === 'text' && typeof data['text'] === 'string') {
    return { ...common, kind: 'text', text: data['text'] };
  }
  if (data?.['kind'] === 'image' && typeof data['imageId'] === 'string') {
    return { ...common, kind: 'image', imageId: data['imageId'] };
  }
  return null;
}

/**
 * Adaptador de `ChatChannel` sobre Cloud Firestore con `firebase-admin`: `chats/{chatId}` con los
 * `participantUids` que leen las reglas, y `chats/{chatId}/messages/{messageId}`. Las escrituras de
 * la API no pasan por las reglas; los clientes solo leen.
 */
export class FirestoreChatChannel implements ChatChannel, ChatMessageLookup {
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

  /**
   * Busca el mensaje por id en los chats indicados con una sola lectura por lotes. Solo devuelve
   * mensajes de usuario, de texto o imagen; los del sistema no se pueden denunciar.
   */
  async findMessage(
    chatIds: readonly string[],
    messageId: string,
  ): Promise<FoundChatMessage | null> {
    if (chatIds.length === 0) return null;
    const references = chatIds.map((chatId) =>
      this.firestore.collection('chats').doc(chatId).collection('messages').doc(messageId),
    );
    const documents = await this.firestore.getAll(...references);
    for (const [index, document] of documents.entries()) {
      const chatId = chatIds[index];
      const message = chatId === undefined || !document.exists ? null : userMessageOf(document);
      if (chatId !== undefined && message !== null) return { chatId, message };
    }
    return null;
  }

  async purgeMessages(chatId: string): Promise<void> {
    // Solo la subcolección de mensajes: el chat conserva sus participantes y el match su historial
    await this.firestore.recursiveDelete(
      this.firestore.collection('chats').doc(chatId).collection('messages'),
    );
  }

  async anonymizeParticipant(
    chatId: string,
    anonymization: ParticipantAnonymization,
  ): Promise<void> {
    const messages = this.firestore.collection('chats').doc(chatId).collection('messages');
    const [sent, system] = await Promise.all([
      messages.where('senderId', '==', anonymization.senderId).get(),
      messages.where('kind', '==', 'system').get(),
    ]);
    const updates: { ref: DocumentReference; data: Record<string, unknown> }[] = [
      ...sent.docs.map((document) => ({
        ref: document.ref,
        data: { senderName: anonymization.displayName },
      })),
      ...system.docs.map((document) => ({
        ref: document.ref,
        data: { participantNames: [...anonymization.participantNames] },
      })),
    ];
    for (let from = 0; from < updates.length; from += BATCH_LIMIT) {
      const batch = this.firestore.batch();
      for (const { ref, data } of updates.slice(from, from + BATCH_LIMIT)) batch.update(ref, data);
      await batch.commit();
    }
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
  const channel = new FirestoreChatChannel(getFirestore(app));
  return { channel, messages: channel, close: () => deleteApp(app) };
}
