import type { Compensation } from '../discovery/discovery-api';
import type { Match } from './matches-api';

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
