import type { CycleType } from '../../domain/matching/cycle.js';
import type { MatchStatus, ParticipantStatus } from '../../domain/matching/match.js';
import type { HomePublicView } from '../home/home-views.js';
import type { MatchParticipantRecord, MatchRecord } from './matching-repository.js';

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

/**
 * `MatchParticipant` del detalle: lo de la lista más la dirección exacta de la vivienda que entrega y
 * su teléfono (`null` si no lo ha autorizado en este match o no tiene uno). Solo se rellenan para los
 * participantes: para el `admin` ninguno de los dos campos existe.
 */
export interface MatchParticipantDetailView extends MatchParticipantView {
  exactAddress?: string;
  phone?: string | null;
  /** Si el participante ha autorizado mostrar su teléfono en este match. */
  sharesPhone?: boolean;
}

/** `MatchDetail` del contrato: el match con las viviendas del ciclo y todas sus fotos. */
export interface MatchDetailView extends Omit<MatchView, 'participants'> {
  participants: MatchParticipantDetailView[];
  homes: HomePublicView[];
}

/** Construido campo a campo: el id del usuario y lo que no se nombra aquí no sale de la API. */
export function toParticipantView(participant: MatchParticipantRecord): MatchParticipantView {
  return {
    homeId: participant.homeId,
    displayName: participant.displayName,
    givesHomeId: participant.givesHomeId,
    receivesHomeId: participant.receivesHomeId,
    compensationCents: participant.compensationCents,
    status: participant.status,
  };
}

export function toMatchView(record: MatchRecord): MatchView {
  return {
    id: record.id,
    type: record.type,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    participants: record.participants.map(toParticipantView),
  };
}
