import { MatchNotFoundError, MatchNotOpenError } from './errors.js';

/** Estados de un match (`MatchStatus` del contrato); `in_operation` llega en la fase 2. */
export const MATCH_STATUSES = ['open', 'confirmed', 'in_operation', 'closed', 'expired'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

/** Estado de cada participante (`ParticipantStatus` del contrato). */
export const PARTICIPANT_STATUSES = ['pending', 'confirmed', 'withdrawn'] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

/** Un match recién formado nace abierto y con todos sus participantes pendientes de confirmar. */
export const NEW_MATCH_STATUS: MatchStatus = 'open';
export const NEW_PARTICIPANT_STATUS: ParticipantStatus = 'pending';

/** Un participante tal como lo ve el dominio: su vivienda, su usuario y su decisión. */
export interface MatchParticipantState {
  readonly homeId: string;
  readonly userId: string;
  readonly status: ParticipantStatus;
}

/** Lo que el dominio necesita de un match para decidir sus transiciones. */
export interface MatchState {
  readonly status: MatchStatus;
  readonly participants: readonly MatchParticipantState[];
}

/** Los participantes de ese usuario; si no figura, el match no existe para él. */
function participantsOf(match: MatchState, userId: string): MatchParticipantState[] {
  const own = match.participants.filter((participant) => participant.userId === userId);
  if (own.length === 0) throw new MatchNotFoundError();
  return own;
}

function withStatus<T extends MatchState>(
  match: T,
  userId: string,
  status: ParticipantStatus,
): T['participants'] {
  return match.participants.map((participant) =>
    participant.userId === userId ? { ...participant, status } : participant,
  );
}

/**
 * El participante confirma su interés. Cuando todos han confirmado, el match pasa a `confirmed`.
 * Confirmar de nuevo no cambia nada; en un match que no está `open` (o si el participante se
 * retiró) no se puede confirmar.
 */
export function confirmInterest<T extends MatchState>(match: T, userId: string): T {
  const own = participantsOf(match, userId);
  if (own.every((participant) => participant.status === 'confirmed')) {
    if (match.status !== 'open' && match.status !== 'confirmed') throw new MatchNotOpenError();
    return match;
  }
  if (match.status !== 'open' || own.some((participant) => participant.status === 'withdrawn')) {
    throw new MatchNotOpenError();
  }
  const participants = withStatus(match, userId, 'confirmed');
  const everyone = participants.every((participant) => participant.status === 'confirmed');
  return { ...match, status: everyone ? 'confirmed' : match.status, participants };
}

/** Un match vivo (`open` o `confirmed`) admite retiradas; el resto ya no. */
export function isLiveMatch(match: MatchState): boolean {
  return match.status === 'open' || match.status === 'confirmed';
}

/**
 * Los datos de contacto (dirección exacta y teléfono) se entregan solo mientras el match está vivo y
 * a quien no se ha retirado; quien no participa nunca los recibe.
 */
export function isContactVisibleTo(match: MatchState, userId: string): boolean {
  const own = match.participants.filter((participant) => participant.userId === userId);
  return (
    own.length > 0 &&
    isLiveMatch(match) &&
    own.every((participant) => participant.status !== 'withdrawn')
  );
}

/** El participante se retira: queda `withdrawn` y el match se cierra para todos (RN-10). */
export function withdrawFromMatch<T extends MatchState>(match: T, userId: string): T {
  participantsOf(match, userId);
  if (match.status !== 'open' && match.status !== 'confirmed') throw new MatchNotOpenError();
  return { ...match, status: 'closed', participants: withStatus(match, userId, 'withdrawn') };
}

/** Compartir el teléfono se puede decidir mientras el match está `open` o `confirmed`. */
export function ensureCanSharePhone(match: MatchState, userId: string): void {
  participantsOf(match, userId);
  if (match.status !== 'open' && match.status !== 'confirmed') throw new MatchNotOpenError();
}

/** Se puede escribir en el chat mientras el match está `open` o `confirmed`; después queda en solo lectura. */
export function ensureCanChat(match: MatchState, userId: string): void {
  participantsOf(match, userId);
  if (match.status !== 'open' && match.status !== 'confirmed') throw new MatchNotOpenError();
}

/** Quien participa en el match, sea cual sea su estado; si no, el match no existe para él. */
export function ensureParticipant(match: MatchState, userId: string): void {
  participantsOf(match, userId);
}
