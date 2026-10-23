import type { Compensation } from '../discovery/discovery-api';
import type { Match, MatchParticipant } from './matches-api';

/** Cómo se rotula un match en la lista; cada valor tiene su texto en `matches.kind`. */
export type MatchKind = 'direct' | 'chain';

export const kindOf = (type: Match['type']): MatchKind => (type === 2 ? 'direct' : 'chain');

/**
 * La compensación de quien mira, con la misma forma que la de una tarjeta: positiva es lo que paga
 * (`compensationCents` de `MatchParticipant`), negativa lo que recibe y cero es un cambio justo.
 */
export function compensationOf(cents: number): Compensation {
  if (cents === 0) return { kind: 'fair', amountCents: 0 };
  return { kind: cents > 0 ? 'pay' : 'receive', amountCents: Math.abs(cents) };
}

export interface MatchView {
  /** La vivienda que recibe quien mira (la del otro); sin saber cuál es la suya, la primera del match. */
  otherHomeId: string | undefined;
  /** Lo que paga o recibe quien mira; `null` si no se sabe cuál de las viviendas es suya. */
  compensation: Compensation | null;
}

/** Lo que importa a quien mira de un match, reconociendo su participación por sus viviendas. */
export function matchViewOf(match: Match, ownHomeIds: ReadonlySet<string>): MatchView {
  const mine = match.participants.find((participant) => ownHomeIds.has(participant.homeId));
  if (!mine) return { otherHomeId: match.participants[0]?.homeId, compensation: null };
  return { otherHomeId: mine.receivesHomeId, compensation: compensationOf(mine.compensationCents) };
}

/** Quién entrega y quién recibe junto a un participante del ciclo. */
export interface Links {
  /** De quien recibe su casa (el que entrega la casa que él recibe). */
  from: MatchParticipant | undefined;
  /** A quien entrega la suya (el que recibe la casa que él entrega). */
  to: MatchParticipant | undefined;
}

export function linksOf(participants: readonly MatchParticipant[], of: MatchParticipant): Links {
  return {
    from: participants.find((candidate) => candidate.givesHomeId === of.receivesHomeId),
    to: participants.find((candidate) => candidate.receivesHomeId === of.givesHomeId),
  };
}

/**
 * Los participantes en el orden del ciclo, empezando por quien mira: él, de quien recibe la casa, y
 * así hasta cerrar. La API los devuelve ordenados por vivienda, no por ciclo, así que se reconstruye
 * con `givesHomeId` y `receivesHomeId`. Si los eslabones no cierran un ciclo con todos, se conserva
 * el orden recibido.
 */
export function cycleOf(
  participants: readonly MatchParticipant[],
  ownHomeIds: ReadonlySet<string>,
): MatchParticipant[] {
  const start = participants.find((p) => ownHomeIds.has(p.homeId)) ?? participants[0];
  if (!start) return [];
  const ordered: MatchParticipant[] = [start];
  let current = linksOf(participants, start).from;
  while (current && !ordered.includes(current)) {
    ordered.push(current);
    current = linksOf(participants, current).from;
  }
  return ordered.length === participants.length && current === start ? ordered : [...participants];
}

/**
 * La tercera casa de una cadena vista por quien mira: la de quien recibe la suya. `undefined` si no
 * es una cadena de tres o no se sabe cuál es su participación.
 */
export function chainThirdHomeIdOf(
  match: Match,
  ownHomeIds: ReadonlySet<string>,
): string | undefined {
  const mine = match.participants.find((participant) => ownHomeIds.has(participant.homeId));
  if (match.type !== 3 || match.participants.length !== 3 || !mine) return undefined;
  return linksOf(match.participants, mine).to?.givesHomeId;
}
