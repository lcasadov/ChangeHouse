import type { PublicHome } from '../discovery/discovery-api';
import { cycleOf } from './match-model';
import type { MatchDetail, MatchParticipant } from './matches-api';

/** Los estados en los que el match sigue vivo y sus participantes pueden decidir. */
const ACTIVE: ReadonlySet<MatchDetail['status']> = new Set(['open', 'confirmed']);

/** Lo que la pantalla de detalle necesita saber de un match, desde el punto de vista de quien mira. */
export interface MatchDetailView {
  /** Mi participación, reconocida por mis viviendas; `undefined` si no se sabe cuál es (p. ej. un admin). */
  mine: MatchParticipant | undefined;
  others: MatchParticipant[];
  /** Es un match en cadena de tres viviendas. */
  isChain: boolean;
  /** Las viviendas en el orden en que se muestran: las ajenas y la mía al final; en cadena, el ciclo desde la mía. */
  sections: MatchParticipant[];
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
  // Quien se ha retirado no recibe datos de contacto ni puede compartir su teléfono
  const decides = mine !== undefined && active && mine.status !== 'withdrawn';
  const others = detail.participants.filter((participant) => participant !== mine);
  const isChain = detail.type === 3 && detail.participants.length === 3;
  const cycle = isChain ? cycleOf(detail.participants, ownHomeIds) : [];
  const direct = mine ? [...others, mine] : detail.participants;
  const sections = isChain ? cycle : direct;
  return {
    mine,
    others: isChain ? cycle.filter((participant) => participant !== mine) : others,
    isChain,
    sections,
    withdrawn: detail.participants.find((participant) => participant.status === 'withdrawn'),
    confirmedCount: detail.participants.filter((participant) => participant.status === 'confirmed')
      .length,
    total: detail.participants.length,
    canConfirm: decides && detail.status === 'open' && mine.status === 'pending',
    hasConfirmed: mine?.status === 'confirmed',
    canWithdraw: decides,
    canSharePhone: decides,
    showContact: active && mine?.status !== 'withdrawn',
    homeOf: (homeId) => detail.homes.find((home) => home.id === homeId),
  };
}
