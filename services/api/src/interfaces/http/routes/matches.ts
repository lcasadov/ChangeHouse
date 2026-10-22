import type { FastifyPluginCallback } from 'fastify';

import type {
  MatchPage,
  MatchViewer,
  MyMatchesQuery,
} from '../../../application/matching/match-operations.js';
import type { MatchDetailView, MatchView } from '../../../application/matching/match-views.js';
import { MatchNotFoundError } from '../../../domain/matching/errors.js';
import { MATCH_STATUSES, type MatchStatus } from '../../../domain/matching/match.js';
import { type FieldError, ValidationFailedError } from '../problem.js';
import { accountId, type PageParams, parsePage, uuidOr404 } from './request-helpers.js';

export interface MatchRouteOptions {
  listMyMatches: (userId: string, query: MyMatchesQuery) => Promise<MatchPage>;
  getMatch: (viewer: MatchViewer, matchId: string) => Promise<MatchDetailView>;
  confirmMatch: (userId: string, matchId: string) => Promise<MatchView>;
  withdrawFromMatch: (userId: string, matchId: string) => Promise<MatchView>;
  setPhoneSharing: (userId: string, matchId: string, share: boolean) => Promise<void>;
}

interface MatchParams {
  matchId: string;
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

/** Un identificador que no es un UUID responde igual que un match inexistente. */
function matchIdOf(request: { params: MatchParams }): string {
  return uuidOr404(request.params.matchId, () => new MatchNotFoundError());
}

/** `{ share: boolean }` y nada más (`additionalProperties: false`). */
function parseShare(body: unknown): boolean {
  const object = typeof body === 'object' && body !== null && !Array.isArray(body);
  const fields: Record<string, unknown> = object ? { ...(body as Record<string, unknown>) } : {};
  const errors: FieldError[] = Object.keys(fields)
    .filter((key) => key !== 'share')
    .map((field) => ({ field, message: 'unknown' }));
  const { share } = fields;
  if (typeof share !== 'boolean') errors.push({ field: 'share', message: 'invalid' });
  if (errors.length > 0 || typeof share !== 'boolean') throw new ValidationFailedError(errors);
  return share;
}

/**
 * `listMyMatches`, `getMatch`, `confirmMatch`, `withdrawFromMatch` y `setPhoneSharing` del contrato
 * (RF-50, RF-53, RF-54). Solo transporte: la política central decide el acceso por rol y los casos de
 * uso, la pertenencia al match (quien no participa recibe 404) y el estado (409).
 */
export function matchRoutes(options: MatchRouteOptions): FastifyPluginCallback {
  return (app, _options, done) => {
    app.get<{ Querystring: ListQuery }>(
      '/matches',
      { config: { operationId: 'listMyMatches' } },
      (request) => options.listMyMatches(accountId(request), parseListQuery(request.query)),
    );
    app.get<{ Params: MatchParams }>(
      '/matches/:matchId',
      { config: { operationId: 'getMatch' } },
      (request) => {
        const account = request.principal?.account;
        if (!account) throw new Error('La operación exige una cuenta y la política no lo comprobó');
        return options.getMatch({ userId: account.userId, role: account.role }, matchIdOf(request));
      },
    );
    app.post<{ Params: MatchParams }>(
      '/matches/:matchId/confirm',
      { config: { operationId: 'confirmMatch' } },
      (request) => options.confirmMatch(accountId(request), matchIdOf(request)),
    );
    app.post<{ Params: MatchParams }>(
      '/matches/:matchId/withdraw',
      { config: { operationId: 'withdrawFromMatch' } },
      (request) => options.withdrawFromMatch(accountId(request), matchIdOf(request)),
    );
    app.put<{ Params: MatchParams }>(
      '/matches/:matchId/phone-sharing',
      { config: { operationId: 'setPhoneSharing' } },
      async (request, reply) => {
        const matchId = matchIdOf(request);
        const share = parseShare(request.body);
        await options.setPhoneSharing(accountId(request), matchId, share);
        return reply.code(204).send();
      },
    );
    done();
  };
}
