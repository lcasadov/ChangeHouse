import type { PublicHome } from '../discovery/discovery-api';
import type { MatchDetail, MatchParticipant } from './matches-api';

/** Los estados en los que el match sigue vivo y sus participantes pueden decidir. */
const ACTIVE: ReadonlySet<MatchDetail['status']> = new Set(['open', 'confirmed']);

/** Lo que la pantalla de detalle necesita saber de un match, desde el punto de vista de quien mira. */
export interface MatchDetailView {
  /** Mi participación, reconocida por mis viviendas; `undefined` si no se sabe cuál es (p. ej. un admin). */
  mine: MatchParticipant | undefined;
  others: MatchParticipant[];
  /** Quien se ha retirado, si alguien lo ha hecho. */
  withdrawn: MatchParticipant | undefined;
  confirmedCount: number;
  total: number;
  /** Mi interés está pendiente y el match lo admite. */
  canConfirm: boolean;
  hasConfirmed: boolean;
  /** Retirarse vale mientras el match está `open` o `confirmed`. */
  canWithdraw: boolean;
  /** Mostrar u ocultar mi teléfono vale en los mismos estados que retirarse. */
  canSharePhone: boolean;
  /** Dirección y teléfonos solo tienen sentido mientras el match sigue vivo. */
  showContact: boolean;
  /** La vivienda que entrega un participante, con sus fotos. */
  homeOf: (homeId: string) => PublicHome | undefined;
}

export function detailViewOf(
  detail: MatchDetail,
  ownHomeIds: ReadonlySet<string>,
): MatchDetailView {
  const mine = detail.participants.find((participant) => ownHomeIds.has(participant.homeId));
  const active = ACTIVE.has(detail.status);
  const decides = mine !== undefined && active;
  return {
    mine,
    others: detail.participants.filter((participant) => participant !== mine),
    withdrawn: detail.participants.find((participant) => participant.status === 'withdrawn'),
    confirmedCount: detail.participants.filter((participant) => participant.status === 'confirmed')
      .length,
    total: detail.participants.length,
    canConfirm: decides && detail.status === 'open' && mine.status === 'pending',
    hasConfirmed: mine?.status === 'confirmed',
    canWithdraw: decides,
    canSharePhone: decides,
    showContact: active,
    homeOf: (homeId) => detail.homes.find((home) => home.id === homeId),
  };
}
