import type { DeviceInput } from '@changehouse/shared';

import type { ChatRoster, ChatSetup } from '../chat/chat-setup.js';
import type { Clock } from '../clock.js';
import {
  MATCH_CLOSED,
  MATCH_CONFIRMED,
  MATCH_CREATED,
  MESSAGE_SENT,
  type OutboxPayload,
} from '../outbox/outbox.js';
import type { DeviceRepository } from './device-repository.js';
import { matchClosedEmail, matchCreatedEmail } from './email-templates.js';
import type {
  EmailNotification,
  EmailNotifier,
  PushNotification,
  PushNotifier,
} from './notifier.js';
import {
  matchClosedPush,
  matchConfirmedPush,
  matchCreatedPush,
  messageSentPush,
} from './push-messages.js';
import type { UserContactDirectory } from './user-contact-directory.js';

export interface NotificationDeps {
  devices: DeviceRepository;
  /** Quién participa en cada match (el mismo puerto que usa el chat). */
  roster: Pick<ChatSetup, 'findRoster'>;
  push: PushNotifier;
  email: EmailNotifier;
  /** Consulta el email y su verificación al despachar; sin verificar no se envía correo. */
  contacts: UserContactDirectory;
  /** URL pública de la app, sin barra final: los emails enlazan a `<appUrl>/match/<id>`. */
  appUrl: string;
  clock: Clock;
}

/** Carga de `message.sent`: el match y quién escribió. */
export interface MessageSentPayload {
  matchId: string;
  senderId: string;
}

/** Envía el aviso a los dispositivos de `userIds` y borra los tokens que el servicio rechaza. */
async function pushTo(
  deps: NotificationDeps,
  userIds: readonly string[],
  notification: PushNotification,
): Promise<void> {
  const tokens = await deps.devices.tokensOf(userIds);
  if (tokens.length === 0) return;
  const result = await deps.push.send(tokens, notification);
  if (result.invalidTokens.length > 0) await deps.devices.deleteTokens(result.invalidTokens);
}

type EmailBuilder = (params: { to: string; link: string }) => EmailNotification;

/** Un email a cada participante con correo verificado; sin cuenta, sin email o sin verificar, se omite. */
async function emailAll(
  deps: NotificationDeps,
  roster: ChatRoster,
  build: EmailBuilder,
): Promise<void> {
  const link = `${deps.appUrl}/match/${roster.matchId}`;
  for (const member of roster.members) {
    const contact = await deps.contacts.findContact(member.firebaseUid);
    if (contact?.email && contact.emailVerified) {
      await deps.email.send(build({ to: contact.email, link }));
    }
  }
}

/** Avisa a todos los participantes; un match que ya no existe no es un error. */
async function notifyAll(
  deps: NotificationDeps,
  matchId: string,
  build: (matchId: string) => PushNotification,
  email?: EmailBuilder,
): Promise<void> {
  const roster = await deps.roster.findRoster(matchId);
  if (!roster) return;
  await pushTo(
    deps,
    roster.members.map((member) => member.userId),
    build(matchId),
  );
  if (email) await emailAll(deps, roster, email);
}

function senderIn(roster: ChatRoster, senderId: string) {
  return roster.members.find((member) => member.userId === senderId);
}

/** Avisa a los demás participantes de un mensaje nuevo, nombrando al remitente y sin su contenido. */
async function notifyMessageSent(
  deps: NotificationDeps,
  payload: MessageSentPayload,
): Promise<void> {
  const roster = await deps.roster.findRoster(payload.matchId);
  const sender = roster ? senderIn(roster, payload.senderId) : undefined;
  if (!roster || !sender) return;
  const others = roster.members
    .filter((member) => member.userId !== payload.senderId)
    .map((member) => member.userId);
  await pushTo(deps, others, messageSentPush(payload.matchId, sender.displayName));
}

/** Los casos de uso de las notificaciones con sus dependencias ya inyectadas. */
export function notificationOperations(deps: NotificationDeps) {
  return {
    registerDevice: (userId: string, input: DeviceInput) =>
      deps.devices.upsert({ ...input, userId, at: deps.clock.now() }),
    notifyMatchCreated: (matchId: string) =>
      notifyAll(deps, matchId, matchCreatedPush, matchCreatedEmail),
    notifyMatchConfirmed: (matchId: string) => notifyAll(deps, matchId, matchConfirmedPush),
    notifyMatchClosed: (matchId: string) =>
      notifyAll(deps, matchId, matchClosedPush, matchClosedEmail),
    notifyMessageSent: (payload: MessageSentPayload) => notifyMessageSent(deps, payload),
  };
}

export type NotificationOperations = ReturnType<typeof notificationOperations>;

function messagePayload(payload: OutboxPayload | null): MessageSentPayload {
  const matchId = payload?.['matchId'];
  const senderId = payload?.['senderId'];
  if (!matchId || !senderId) {
    throw new Error('El hecho message.sent no lleva el match y el remitente');
  }
  return { matchId, senderId };
}

/** Manejadores de la bandeja de salida: un tipo de hecho, un aviso. */
export function notificationHandlers(operations: NotificationOperations) {
  return {
    [MATCH_CREATED]: (matchId: string) => operations.notifyMatchCreated(matchId),
    [MATCH_CONFIRMED]: (matchId: string) => operations.notifyMatchConfirmed(matchId),
    [MATCH_CLOSED]: (matchId: string) => operations.notifyMatchClosed(matchId),
    [MESSAGE_SENT]: (_messageId: string, payload: OutboxPayload | null) =>
      operations.notifyMessageSent(messagePayload(payload)),
  } as const;
}
