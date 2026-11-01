import { isWaitlistPurgeDue, retentionCutoff } from '../../domain/retention/retention.js';
import type { ChatChannel } from '../chat/chat-channel.js';
import type { ChatImageStorage } from '../chat/chat-image-storage.js';
import type { Clock } from '../clock.js';
import type { AuditLog } from '../moderation/audit-log.js';

/** Un chat cuyo match se cerró hace más del plazo de conservación y aún no se ha purgado. */
export interface ExpiredChat {
  matchId: string;
  /** `null` si el chat de Firestore nunca llegó a crearse. */
  chatId: string | null;
}

/** Puerto de salida: los chats de matches cerrados a purgar y su marca. */
export interface ExpiredChatStore {
  /** Los más antiguos primero, hasta `limit`: `closed`, con `closed_at < cutoff` y sin purgar. */
  findExpired(cutoff: Date, limit: number): Promise<ExpiredChat[]>;
  /** Marca el chat del match como purgado (`chat_purged_at`). */
  markPurged(matchId: string, at: Date): Promise<void>;
}

/** Puerto de salida: la lista de espera, solo para purgarla. */
export interface WaitlistPurgeStore {
  /** Borra todas las inscripciones y devuelve cuántas había. */
  deleteAll(): Promise<number>;
}

export interface RetentionScope {
  chats: ExpiredChatStore;
  waitlist: WaitlistPurgeStore;
  audit: AuditLog;
}

/** Resultado de intentar ejecutar bajo el bloqueo consultivo. */
export type Exclusive<T> = { ran: true; value: T } | { ran: false };

/**
 * Puerto de salida: ejecuta el trabajo en una transacción protegida por un bloqueo consultivo, de
 * modo que solo una instancia purga a la vez. Si otra lo tiene, no ejecuta nada (`ran: false`).
 */
export interface RetentionUnitOfWork {
  runExclusive<T>(work: (scope: RetentionScope) => Promise<T>): Promise<Exclusive<T>>;
}

export interface RetentionDeps {
  units: RetentionUnitOfWork;
  channel: Pick<ChatChannel, 'purgeMessages'>;
  storage: Pick<ChatImageStorage, 'deleteMatchImages'>;
  clock: Clock;
  /** Fecha de lanzamiento (`LAUNCH_DATE`); sin ella la lista de espera no se purga. */
  launchDate: Date | undefined;
  /** Se avisa de cada chat que no se pudo purgar; se reintenta en la siguiente ejecución. */
  onError: (error: unknown, matchId: string) => void;
}

export interface PurgeSummary {
  /** `false` si otra instancia tenía el bloqueo y esta no hizo nada. */
  ran: boolean;
  chats: number;
  waitlist: number;
}

/** Chats que se purgan por ejecución; si hay más, siguen en la del día siguiente. */
const CHAT_BATCH_SIZE = 500;

/** Borra los mensajes de Firestore y las imágenes del match; ambos pasos son idempotentes. */
async function eraseChat(deps: RetentionDeps, chat: ExpiredChat): Promise<void> {
  if (chat.chatId !== null) await deps.channel.purgeMessages(chat.chatId);
  await deps.storage.deleteMatchImages(chat.matchId);
}

async function purgeChats(deps: RetentionDeps, scope: RetentionScope, now: Date): Promise<number> {
  const expired = await scope.chats.findExpired(retentionCutoff(now), CHAT_BATCH_SIZE);
  let purged = 0;
  for (const chat of expired) {
    try {
      await eraseChat(deps, chat);
      await scope.chats.markPurged(chat.matchId, now);
      purged += 1;
    } catch (error) {
      deps.onError(error, chat.matchId);
    }
  }
  if (purged > 0) {
    await scope.audit.record({
      actorId: null,
      action: 'retention.purge',
      entity: 'chat',
      entityId: null,
      detail: { count: purged },
      at: now,
    });
  }
  return purged;
}

async function purgeWaitlist(
  deps: RetentionDeps,
  scope: RetentionScope,
  now: Date,
): Promise<number> {
  if (!isWaitlistPurgeDue(deps.launchDate, now)) return 0;
  const deleted = await scope.waitlist.deleteAll();
  if (deleted > 0) {
    await scope.audit.record({
      actorId: null,
      action: 'retention.purge',
      entity: 'waitlist',
      entityId: null,
      detail: { count: deleted },
      at: now,
    });
  }
  return deleted;
}

/**
 * Purga programada de la retención de datos: los chats de los matches cerrados hace más de 12 meses
 * y la lista de espera a los 12 meses del lanzamiento. Cada purga con efecto deja una entrada de
 * auditoría con el recuento. Las instancias se turnan con un bloqueo consultivo.
 */
async function run(deps: RetentionDeps): Promise<PurgeSummary> {
  const now = deps.clock.now();
  const outcome = await deps.units.runExclusive(async (scope) => ({
    chats: await purgeChats(deps, scope, now),
    waitlist: await purgeWaitlist(deps, scope, now),
  }));
  return outcome.ran ? { ran: true, ...outcome.value } : { ran: false, chats: 0, waitlist: 0 };
}

/** El caso de uso con sus dependencias ya inyectadas. */
export function retentionOperations(deps: RetentionDeps) {
  return { run: () => run(deps) };
}
