import type { MatchStatus } from '../../domain/matching/match.js';
import { encodeCursor, type ModerationCursor } from '../moderation/cursor.js';
import { type MatchView, toMatchView } from './match-views.js';
import type { MatchReader } from './matching-repository.js';

export interface MatchDeps {
  matches: MatchReader;
}

export interface MyMatchesQuery {
  status?: MatchStatus;
  after?: ModerationCursor;
  limit: number;
}

export interface MatchPage {
  items: MatchView[];
  nextCursor: string | null;
}

/**
 * Matches en los que participa alguna vivienda del usuario (RF-50), del más reciente al más
 * antiguo; nunca los ajenos. Un `seeker` (p. ej. con su vivienda pausada) también ve los suyos.
 */
async function listMyMatches(
  deps: MatchDeps,
  userId: string,
  query: MyMatchesQuery,
): Promise<MatchPage> {
  // Una más de las pedidas: si llega, hay otra página
  const found = await deps.matches.listForUser({
    userId,
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.after === undefined ? {} : { after: query.after }),
    limit: query.limit + 1,
  });
  const page = found.slice(0, query.limit);
  const last = page.at(-1);
  const nextCursor =
    found.length > query.limit && last ? encodeCursor({ at: last.createdAt, id: last.id }) : null;
  return { items: page.map(toMatchView), nextCursor };
}

/** Los casos de uso de los matches con sus dependencias ya inyectadas, listos para el transporte. */
export function matchOperations(deps: MatchDeps) {
  return {
    listMyMatches: (userId: string, query: MyMatchesQuery) => listMyMatches(deps, userId, query),
  };
}
