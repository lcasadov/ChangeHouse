import type { CycleType } from '../../domain/matching/cycle.js';
import type { MatchStatus, ParticipantStatus } from '../../domain/matching/match.js';
import type { MatchRecord } from './matching-repository.js';

/**
 * `MatchParticipant` del contrato en su forma de lista: sin teléfono (llega con `setPhoneSharing`)
 * ni dirección exacta (solo en el detalle del match), y sin el id interno del usuario.
 */
export interface MatchParticipantView {
  homeId: string;
  displayName: string;
  givesHomeId: string;
  receivesHomeId: string;
  compensationCents: number;
  status: ParticipantStatus;
}

/** `Match` del contrato; `chatId` no aparece hasta que exista el chat (`add-match-chat`). */
export interface MatchView {
  id: string;
  type: CycleType;
  status: MatchStatus;
  createdAt: string;
  participants: MatchParticipantView[];
}

export function toMatchView(record: MatchRecord): MatchView {
  return {
    id: record.id,
    type: record.type,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    participants: record.participants.map((participant) => ({
      homeId: participant.homeId,
      displayName: participant.displayName,
      givesHomeId: participant.givesHomeId,
      receivesHomeId: participant.receivesHomeId,
      compensationCents: participant.compensationCents,
      status: participant.status,
    })),
  };
}
