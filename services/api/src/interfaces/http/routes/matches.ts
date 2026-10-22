import type { FastifyPluginCallback } from 'fastify';

import type { MatchPage, MyMatchesQuery } from '../../../application/matching/match-operations.js';
import { MATCH_STATUSES, type MatchStatus } from '../../../domain/matching/match.js';
import { type FieldError, ValidationFailedError } from '../problem.js';
import { accountId, type PageParams, parsePage } from './request-helpers.js';

export interface MatchRouteOptions {
  listMyMatches: (userId: string, query: MyMatchesQuery) => Promise<MatchPage>;
}

interface ListQuery extends PageParams {
  status?: string;
}

function isMatchStatus(value: string): value is MatchStatus {
  return (MATCH_STATUSES as readonly string[]).includes(value);
}

/** `status`, `cursor` y `limit` de `listMyMatches`; cada parámetro erróneo se señala por su nombre. */
function parseListQuery(query: ListQuery): MyMatchesQuery {
  const errors: FieldError[] = [];
  const { status } = query;
  if (status !== undefined && !isMatchStatus(status)) {
    errors.push({ field: 'status', message: 'invalid' });
  }
  const { cursor, limit } = parsePage(query, errors);
  if (errors.length > 0) throw new ValidationFailedError(errors);
  return {
    ...(status !== undefined && isMatchStatus(status) ? { status } : {}),
    ...(cursor === undefined ? {} : { after: cursor }),
    limit,
  };
}

/**
 * `listMyMatches` del contrato (RF-50). Solo transporte: la política central restringe a `owner` y
 * `seeker`, y el caso de uso devuelve solo los matches en los que participa el usuario.
 */
export function matchRoutes(options: MatchRouteOptions): FastifyPluginCallback {
  return (app, _options, done) => {
    app.get<{ Querystring: ListQuery }>(
      '/matches',
      { config: { operationId: 'listMyMatches' } },
      (request) => options.listMyMatches(accountId(request), parseListQuery(request.query)),
    );
    done();
  };
}
