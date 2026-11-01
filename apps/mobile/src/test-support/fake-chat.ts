import type { PhotoContentType } from '@changehouse/shared';

import {
  type ChatApi,
  ChatApiError,
  type ChatApiErrorKind,
  type ChatImageUpload,
  type ChatImageUrl,
  type OutgoingContent,
  type SentMessage,
} from '../features/chat/chat-api';
import type {
  ChatMessage,
  ChatMessages,
  ChatMessagesListener,
} from '../features/chat/chat-messages';

export const CHAT_ID = 'chat-1';
export const OTHER_ID = '0198f3a0-0000-7000-8000-0000000000bb';

let sequence = 0;
const nextId = () => `0198f3a0-eeee-7000-8000-${String((sequence += 1)).padStart(12, '0')}`;

/** La hora de un mensaje: el 19 de oct de 2026 a las 10:00 (hora local) más los minutos dados. */
export const at = (minutes: number): Date => new Date(2026, 9, 19, 10, minutes);

export function textFrom(
  senderName: string,
  text: string,
  minutes = 0,
  senderId = OTHER_ID,
): ChatMessage {
  return { id: nextId(), kind: 'text', senderId, senderName, text, createdAt: at(minutes) };
}

export function imageFrom(
  senderName: string,
  imageId: string,
  minutes = 0,
  senderId = OTHER_ID,
): ChatMessage {
  return { id: nextId(), kind: 'image', senderId, senderName, imageId, createdAt: at(minutes) };
}

export function welcome(participantNames: string[] = ['Ana', 'Beto']): ChatMessage {
  return { id: 'welcome', kind: 'system', event: 'welcome', participantNames, createdAt: at(0) };
}

/**
 * El canal de mensajes en tiempo real simulado, en la frontera del puerto: no entrega nada hasta que
 * se siembra o se publica (así se prueba «cargando») y cada cambio llega como una foto completa del
 * chat, igual que un `onSnapshot`.
 */
export class FakeChatMessages implements ChatMessages {
  readonly subscriptions: string[] = [];
  active = 0;
  private readonly stored = new Map<string, ChatMessage[]>();
  private readonly listeners = new Map<string, Set<ChatMessagesListener>>();

  subscribe(chatId: string, listener: ChatMessagesListener): () => void {
    this.subscriptions.push(chatId);
    this.active += 1;
    const set = this.listeners.get(chatId) ?? new Set<ChatMessagesListener>();
    set.add(listener);
    this.listeners.set(chatId, set);
    const current = this.stored.get(chatId);
    if (current) listener.onMessages([...current]);
    return () => {
      this.active -= 1;
      set.delete(listener);
    };
  }

  /** El chat ya tiene estos mensajes: los entrega a quien escucha y a quien escuche después. */
  seed(chatId: string, messages: readonly ChatMessage[]): void {
    this.stored.set(chatId, [...messages]);
    for (const listener of this.listeners.get(chatId) ?? []) listener.onMessages([...messages]);
  }

  /** Llega un mensaje nuevo (de otra persona o escrito por la API) a quien escucha. */
  push(chatId: string, message: ChatMessage): void {
    this.seed(chatId, [...(this.stored.get(chatId) ?? []), message]);
  }

  /** El canal falla (por ejemplo, sin permiso). */
  fail(chatId: string): void {
    for (const listener of this.listeners.get(chatId) ?? []) listener.onError();
  }
}

export interface SentRecord {
  matchId: string;
  content: OutgoingContent;
}

export interface FakeChatApiOptions {
  /** Donde la API «escribe» los mensajes enviados, como hace con Firestore. */
  channel?: FakeChatMessages;
  chatId?: string;
  sender?: { id: string; name: string };
}

/** La API del chat simulada: registra lo enviado y puede fallar con el error que se prepare. */
export class FakeChatApi implements ChatApi {
  readonly sent: SentRecord[] = [];
  readonly uploads: { matchId: string; contentType: PhotoContentType }[] = [];
  readonly imageRequests: { matchId: string; imageId: string }[] = [];
  /** El tiempo de vida de cada URL de imagen que se entrega. */
  imageUrlTtlMs = 15 * 60_000;
  private readonly failures: ChatApiErrorKind[] = [];
  private readonly uploadFailures: ChatApiErrorKind[] = [];
  private readonly imageFailures: ChatApiErrorKind[] = [];
  private gate: Promise<void> | null = null;

  constructor(private readonly options: FakeChatApiOptions = {}) {}

  /** Los siguientes envíos fallan con estos errores, en orden, antes de volver a funcionar. */
  failNext(...kinds: ChatApiErrorKind[]): void {
    this.failures.push(...kinds);
  }

  /** Las siguientes peticiones de URL de subida de imagen fallan con estos errores, en orden. */
  failNextUpload(...kinds: ChatApiErrorKind[]): void {
    this.uploadFailures.push(...kinds);
  }

  /** La siguiente petición de URL de imagen falla con este error. */
  failNextImageUrl(kind: ChatApiErrorKind): void {
    this.imageFailures.push(kind);
  }

  /** Retiene el siguiente envío hasta llamar a la función devuelta (para probar «enviando»). */
  hold(): () => void {
    let release: () => void = () => undefined;
    this.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    return release;
  }

  async sendMessage(matchId: string, content: OutgoingContent): Promise<SentMessage> {
    this.sent.push({ matchId, content });
    const gate = this.gate;
    this.gate = null;
    await gate;
    const failure = this.failures.shift();
    if (failure) throw new ChatApiError(failure);
    const id = nextId();
    const { channel, chatId = CHAT_ID, sender = { id: 'me', name: 'Ana' } } = this.options;
    if (channel) {
      const base = { id, senderId: sender.id, senderName: sender.name, createdAt: at(30) };
      channel.push(
        chatId,
        'text' in content
          ? { ...base, kind: 'text', text: content.text }
          : { ...base, kind: 'image', imageId: id },
      );
    }
    return { id };
  }

  createImageUpload(matchId: string, contentType: PhotoContentType): Promise<ChatImageUpload> {
    const failure = this.uploadFailures.shift();
    if (failure) return Promise.reject(new ChatApiError(failure));
    this.uploads.push({ matchId, contentType });
    return Promise.resolve({
      uploadId: nextId(),
      uploadUrl: `https://storage.test/chat/${String(this.uploads.length)}`,
    });
  }

  getImageUrl(matchId: string, imageId: string): Promise<ChatImageUrl> {
    this.imageRequests.push({ matchId, imageId });
    const failure = this.imageFailures.shift();
    if (failure) return Promise.reject(new ChatApiError(failure));
    return Promise.resolve({
      url: `https://storage.test/signed/${imageId}?n=${String(this.imageRequests.length)}`,
      expiresAt: new Date(Date.now() + this.imageUrlTtlMs),
    });
  }
}
