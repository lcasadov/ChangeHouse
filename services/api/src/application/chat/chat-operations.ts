import type { PhotoContentType, SendMessageInput } from '@changehouse/shared';

import {
  ChatImageNotFoundError,
  ChatNotReadyError,
  ImageNotUploadedError,
} from '../../domain/chat/errors.js';
import { InvalidImageError } from '../../domain/home/errors.js';
import { MatchNotFoundError } from '../../domain/matching/errors.js';
import { ensureCanChat, ensureParticipant } from '../../domain/matching/match.js';
import type { Clock } from '../clock.js';
import type { ImageProcessor } from '../home/image-processor.js';
import { MAX_ORIGINAL_BYTES } from '../home/photo-operations.js';
import type { IdGenerator } from '../id-generator.js';
import type { MatchReader, MatchRecord } from '../matching/matching-repository.js';
import { MESSAGE_SENT, type OutboxWriter } from '../outbox/outbox.js';
import type { ChatChannel, ChatMessageRecord } from './chat-channel.js';
import type { ChatImageStorage } from './chat-image-storage.js';
import { chatImagePath, chatUploadPath } from './chat-paths.js';
import type { ChatSetup } from './chat-setup.js';

/** Vigencia de la URL firmada de subida y de la de lectura de una imagen del chat. */
const IMAGE_URL_MINUTES = 15;
const MS_PER_MINUTE = 60_000;

export interface ChatDeps {
  matches: Pick<MatchReader, 'findById'>;
  setup: ChatSetup;
  channel: ChatChannel;
  /** Registra el aviso de cada mensaje publicado; lo entrega el despachador, no esta petición. */
  outbox: OutboxWriter;
  /** Se avisa si falla el registro del aviso de un mensaje ya publicado; la respuesta no cambia. */
  onEnqueueError: (error: unknown) => void;
  storage: ChatImageStorage;
  images: ImageProcessor;
  clock: Clock;
  ids: IdGenerator;
}

/** `ChatMessage` del contrato: el mensaje recién enviado, sin el id interno del remitente. */
export interface ChatMessageView {
  id: string;
  kind: 'text' | 'image';
  text: string | null;
  imageUrl: string | null;
  createdAt: string;
}

/** `ChatImageUrl` del contrato. */
export interface ChatImageUrlView {
  url: string;
  expiresAt: string;
}

/** `ChatImageUpload` del contrato. */
export interface ChatImageUploadView {
  uploadId: string;
  uploadUrl: string;
  expiresAt: string;
}

/** El chat de cada match comparte su identificador: así crearlo dos veces nunca lo duplica. */
function chatIdOf(matchId: string): string {
  return matchId;
}

/** Crea el chat de un match recién creado y lo enlaza; es idempotente y reintentable. */
async function createChatForMatch(deps: ChatDeps, matchId: string): Promise<void> {
  const roster = await deps.setup.findRoster(matchId);
  if (!roster || roster.chatId !== null) return;

  const now = deps.clock.now();
  const chatId = chatIdOf(matchId);
  await deps.channel.createChat({
    chatId,
    matchId,
    participantUids: roster.members.map((member) => member.firebaseUid),
    welcome: {
      id: 'welcome',
      kind: 'system',
      event: 'welcome',
      participantNames: roster.members.map((member) => member.displayName),
      createdAt: now,
    },
    createdAt: now,
  });
  await deps.setup.linkChat(matchId, chatId);
}

/** El match en el que el usuario puede escribir: participante (si no, 404) y abierto o confirmado (si no, 409). */
async function writableMatch(
  deps: ChatDeps,
  userId: string,
  matchId: string,
): Promise<MatchRecord> {
  const match = await deps.matches.findById(matchId);
  if (!match) throw new MatchNotFoundError();
  ensureCanChat(match, userId);
  return match;
}

function senderOf(match: MatchRecord, userId: string): { senderId: string; senderName: string } {
  const participant = match.participants.find((candidate) => candidate.userId === userId);
  if (!participant) throw new MatchNotFoundError();
  return { senderId: userId, senderName: participant.displayName };
}

function chatIdFor(match: MatchRecord): string {
  if (!match.chatId) throw new ChatNotReadyError();
  return match.chatId;
}

async function createChatImageUpload(
  deps: ChatDeps,
  userId: string,
  matchId: string,
  contentType: PhotoContentType,
): Promise<ChatImageUploadView> {
  await writableMatch(deps, userId, matchId);
  const uploadId = deps.ids.next();
  const expiresAt = new Date(deps.clock.now().getTime() + IMAGE_URL_MINUTES * MS_PER_MINUTE);
  const uploadUrl = await deps.storage.createUploadUrl(
    chatUploadPath(matchId, userId, uploadId),
    contentType,
    expiresAt,
  );
  return { uploadId, uploadUrl, expiresAt: expiresAt.toISOString() };
}

/** El aviso lleva solo los identificadores: ni el texto ni la imagen salen de Firestore. */
async function enqueueMessageSent(
  deps: ChatDeps,
  matchId: string,
  senderId: string,
  messageId: string,
): Promise<void> {
  try {
    await deps.outbox.enqueue({
      id: deps.ids.next(),
      type: MESSAGE_SENT,
      aggregateId: messageId,
      payload: { matchId, senderId },
      at: deps.clock.now(),
    });
  } catch (error) {
    // El mensaje ya está publicado: fallar aquí haría reintentar al cliente y duplicarlo
    deps.onEnqueueError(error);
  }
}

async function sendText(
  deps: ChatDeps,
  matchId: string,
  chatId: string,
  sender: { senderId: string; senderName: string },
  text: string,
): Promise<ChatMessageView> {
  const message: ChatMessageRecord = {
    id: deps.ids.next(),
    kind: 'text',
    ...sender,
    text,
    createdAt: deps.clock.now(),
  };
  await deps.channel.appendMessage(chatId, message);
  await enqueueMessageSent(deps, matchId, sender.senderId, message.id);
  return {
    id: message.id,
    kind: 'text',
    text,
    imageUrl: null,
    createdAt: message.createdAt.toISOString(),
  };
}

/** Procesa el original subido; si no es una imagen válida lo descarta y propaga el error. */
async function processUpload(deps: ChatDeps, uploadPath: string, imagePath: string): Promise<void> {
  const original = await deps.storage.readOriginal(uploadPath, MAX_ORIGINAL_BYTES);
  if (original.status === 'missing') throw new ImageNotUploadedError();
  try {
    if (original.status === 'too_large') throw new InvalidImageError();
    const processed = await deps.images.process(original.data);
    await deps.storage.store(imagePath, processed.data, processed.contentType);
  } catch (error) {
    if (error instanceof InvalidImageError) await deps.storage.delete(uploadPath);
    throw error;
  }
}

async function sendImage(
  deps: ChatDeps,
  match: MatchRecord,
  chatId: string,
  sender: { senderId: string; senderName: string },
  uploadId: string,
): Promise<ChatMessageView> {
  const uploadPath = chatUploadPath(match.id, sender.senderId, uploadId);
  const messageId = deps.ids.next();
  // El id de la imagen es el del mensaje: opaco para el cliente, la ruta solo la conoce la API
  const imagePath = chatImagePath(match.id, messageId);
  await processUpload(deps, uploadPath, imagePath);

  const createdAt = deps.clock.now();
  try {
    await deps.channel.appendMessage(chatId, {
      id: messageId,
      kind: 'image',
      ...sender,
      imageId: messageId,
      createdAt,
    });
  } catch (error) {
    // El original se conserva: el cliente puede reintentar el envío con el mismo `imageUploadId`
    await deps.storage.delete(imagePath);
    throw error;
  }
  await deps.storage.delete(uploadPath);
  await enqueueMessageSent(deps, match.id, sender.senderId, messageId);
  const expiresAt = new Date(createdAt.getTime() + IMAGE_URL_MINUTES * MS_PER_MINUTE);
  return {
    id: messageId,
    kind: 'image',
    text: null,
    imageUrl: await deps.storage.signedReadUrl(imagePath, expiresAt),
    createdAt: createdAt.toISOString(),
  };
}

/**
 * Un participante envía un texto o una imagen al chat de su match. Toda la validación ocurre antes
 * de cualquier efecto: pertenencia (404), estado (409), chat creado (409) e imagen subida (422).
 */
async function sendMatchMessage(
  deps: ChatDeps,
  userId: string,
  matchId: string,
  input: SendMessageInput,
): Promise<ChatMessageView> {
  const match = await writableMatch(deps, userId, matchId);
  const chatId = chatIdFor(match);
  const sender = senderOf(match, userId);
  if (input.kind === 'text') return sendText(deps, matchId, chatId, sender, input.text);
  return sendImage(deps, match, chatId, sender, input.imageUploadId);
}

/**
 * URL firmada de corta duración de una imagen del chat para cualquier participante, también con el
 * match cerrado (el historial sigue siendo legible). El id solo se resuelve dentro de este match.
 */
async function getChatImageUrl(
  deps: ChatDeps,
  userId: string,
  matchId: string,
  imageId: string,
): Promise<ChatImageUrlView> {
  const match = await deps.matches.findById(matchId);
  if (!match) throw new MatchNotFoundError();
  ensureParticipant(match, userId);
  const path = chatImagePath(matchId, imageId);
  if (!(await deps.storage.exists(path))) throw new ChatImageNotFoundError();
  const expiresAt = new Date(deps.clock.now().getTime() + IMAGE_URL_MINUTES * MS_PER_MINUTE);
  return {
    url: await deps.storage.signedReadUrl(path, expiresAt),
    expiresAt: expiresAt.toISOString(),
  };
}

/** Los casos de uso del chat con sus dependencias ya inyectadas, listos para el transporte. */
export function chatOperations(deps: ChatDeps) {
  return {
    createChatForMatch: (matchId: string) => createChatForMatch(deps, matchId),
    sendMatchMessage: (userId: string, matchId: string, input: SendMessageInput) =>
      sendMatchMessage(deps, userId, matchId, input),
    getChatImageUrl: (userId: string, matchId: string, imageId: string) =>
      getChatImageUrl(deps, userId, matchId, imageId),
    createChatImageUpload: (userId: string, matchId: string, contentType: PhotoContentType) =>
      createChatImageUpload(deps, userId, matchId, contentType),
  };
}
