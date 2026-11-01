import { CHAT_MESSAGE_MAX_LENGTH, type PhotoContentType } from '@changehouse/shared';

import type { MatchDetail } from '../matches/matches-api';
import { ChatApiError } from './chat-api';
import type { ChatMessage } from './chat-messages';

/** La API solo admite mensajes mientras el match está `open` o `confirmed`; en otro estado el chat es de solo lectura. */
const WRITABLE: ReadonlySet<MatchDetail['status']> = new Set(['open', 'confirmed']);

export const isChatWritable = (status: MatchDetail['status']): boolean => WRITABLE.has(status);

export type DraftState = 'empty' | 'ok' | 'too-long';

/** Si lo escrito se puede enviar: la API recorta los espacios de los extremos y cuenta el resto. */
export function draftStateOf(text: string): DraftState {
  const length = text.trim().length;
  if (length === 0) return 'empty';
  return length > CHAT_MESSAGE_MAX_LENGTH ? 'too-long' : 'ok';
}

/** Un recuento con punto de millares también en cuatro cifras («2.000»), como pide la guía de estilo. */
export const formatCount = (value: number, language: string): string =>
  new Intl.NumberFormat(language, { useGrouping: 'always' }).format(value);

/** Por qué un envío no ha salido; cada valor tiene su texto en `chat.failure`. */
export type OutgoingFailure =
  'network' | 'server' | 'notReady' | 'tooLong' | 'invalidImage' | 'closed';

const FAILURE_OF_KIND: Partial<Record<ChatApiError['kind'], OutgoingFailure>> = {
  network: 'network',
  'too-long': 'tooLong',
  'not-open': 'closed',
  'not-ready': 'notReady',
  'invalid-image': 'invalidImage',
  // La imagen no llegó al almacenamiento: se vuelve a subir al reintentar
  'image-not-uploaded': 'network',
};

/** Un fallo que no es de la API es el envío del fichero al almacenamiento: se trata como de red. */
export function failureOf(error: unknown): OutgoingFailure {
  if (!(error instanceof ChatApiError)) return 'network';
  return FAILURE_OF_KIND[error.kind] ?? 'server';
}

/** Lo que se arregla volviendo a intentarlo; el resto solo se puede descartar. */
const RETRYABLE: ReadonlySet<OutgoingFailure> = new Set(['network', 'server', 'notReady']);

export const canRetry = (failure: OutgoingFailure | undefined): boolean =>
  failure !== undefined && RETRYABLE.has(failure);

/** Un mensaje que esta persona está enviando o ha enviado y aún no ha llegado del canal en tiempo real. */
export interface OutgoingMessage {
  /** Identificador local: el mensaje todavía no tiene el de la API. */
  key: string;
  kind: 'text' | 'image';
  text?: string;
  /** La foto elegida en la galería; se enseña mientras se envía. */
  uri?: string;
  contentType?: PhotoContentType;
  stage: 'sending' | 'sent' | 'failed';
  failure?: OutgoingFailure;
  /** El id que devolvió la API: el mismo que tendrá el mensaje en el canal. */
  serverId?: string;
  /** La subida de la imagen, para no repetirla si solo falló el envío. */
  uploadId?: string;
  uploaded?: boolean;
  /**
   * Ids de los mensajes del canal que ya estaban cuando se encoló el envío: ninguno de ellos puede
   * ser su eco. Sin él (`undefined`) el envío solo se reconcilia por `serverId`.
   */
  seenRemoteIds?: ReadonlySet<string>;
  createdAt: Date;
}

export interface SystemItem {
  type: 'system';
  key: string;
  participantNames: string[];
  createdAt: Date;
}

export interface MessageItem {
  type: 'message';
  key: string;
  mine: boolean;
  senderName: string;
  /** Quién lo escribió; solo en los mensajes que llegan del canal. */
  senderId?: string;
  kind: 'text' | 'image';
  text?: string;
  imageId?: string;
  localUri?: string;
  state: 'sent' | 'sending' | 'failed';
  failure?: OutgoingFailure;
  /** Presente en los envíos locales: con él se reintenta o se descarta. */
  outgoingKey?: string;
  createdAt: Date;
}

export type ChatItem = SystemItem | MessageItem;

function remoteItem(message: ChatMessage, meId: string | undefined): ChatItem {
  if (message.kind === 'system') {
    return {
      type: 'system',
      key: message.id,
      participantNames: message.participantNames,
      createdAt: message.createdAt,
    };
  }
  return {
    type: 'message',
    key: message.id,
    mine: message.senderId === meId,
    senderName: message.senderName,
    senderId: message.senderId,
    kind: message.kind,
    ...(message.kind === 'text' ? { text: message.text } : { imageId: message.imageId }),
    state: 'sent',
    createdAt: message.createdAt,
  };
}

function outgoingItem(message: OutgoingMessage): MessageItem {
  return {
    type: 'message',
    key: message.key,
    mine: true,
    senderName: '',
    kind: message.kind,
    ...(message.text === undefined ? {} : { text: message.text }),
    ...(message.uri === undefined ? {} : { localUri: message.uri }),
    state: message.stage,
    ...(message.failure === undefined ? {} : { failure: message.failure }),
    outgoingKey: message.key,
    createdAt: message.createdAt,
  };
}

/** Si el mensaje del canal puede ser el eco de este envío local que aún no conoce su `serverId`. */
function echoes(message: OutgoingMessage, remote: ChatMessage, meId: string): boolean {
  if (message.stage !== 'sending' || message.seenRemoteIds === undefined) return false;
  if (remote.kind === 'system' || remote.senderId !== meId) return false;
  if (message.seenRemoteIds.has(remote.id) || remote.kind !== message.kind) return false;
  return remote.kind === 'image' || remote.text === message.text;
}

/**
 * Los envíos locales cuyo mensaje ya está en el canal. Uno con `serverId` se reconoce por su id. Si
 * el canal gana la carrera a la respuesta de la API, aún no tiene `serverId`: se empareja, uno a uno
 * y en orden, con un mensaje mío del mismo tipo y contenido que no estuviera al encolarlo y que
 * ningún otro envío haya reclamado (así dos envíos iguales seguidos no se ocultan entre sí).
 */
function arrivedOutgoing(
  remote: readonly ChatMessage[],
  outgoing: readonly OutgoingMessage[],
  meId: string | undefined,
): Set<string> {
  const remoteIds = new Set(remote.map((message) => message.id));
  const known = new Set(outgoing.flatMap((message) => message.serverId ?? []));
  const arrived = new Set<string>();
  const taken = new Set<string>(known);
  for (const message of outgoing) {
    if (message.serverId !== undefined) {
      if (remoteIds.has(message.serverId)) arrived.add(message.key);
    } else if (meId !== undefined) {
      const match = remote.find((item) => !taken.has(item.id) && echoes(message, item, meId));
      if (match) {
        taken.add(match.id);
        arrived.add(message.key);
      }
    }
  }
  return arrived;
}

/**
 * Lo que se pinta: los mensajes del canal en su orden y, al final, los envíos locales que el canal
 * aún no ha devuelto (en cuanto llega el mensaje, el local desaparece).
 */
export function chatItemsOf(
  remote: readonly ChatMessage[],
  outgoing: readonly OutgoingMessage[],
  meId: string | undefined,
): ChatItem[] {
  const arrived = arrivedOutgoing(remote, outgoing, meId);
  const pending = outgoing.filter((message) => !arrived.has(message.key));
  return [...remote.map((message) => remoteItem(message, meId)), ...pending.map(outgoingItem)];
}

/** Margen antes de la caducidad en que una URL firmada deja de reutilizarse. */
const URL_SAFETY_MARGIN_MS = 60_000;

/** Cuánto tiempo más se puede reutilizar una URL firmada de imagen; 0 si está a punto de caducar. */
export function imageUrlFreshForMs(expiresAt: Date, now: number = Date.now()): number {
  return Math.max(0, expiresAt.getTime() - now - URL_SAFETY_MARGIN_MS);
}
