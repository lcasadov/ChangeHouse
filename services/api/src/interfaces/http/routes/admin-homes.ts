import {
  HOME_STATUSES,
  type HomeStatus,
  type ModerationInput,
  validateModerationInput,
} from '@changehouse/shared';
import type { FastifyPluginCallback } from 'fastify';

import { HomeNotFoundError } from '../../../application/home/errors.js';
import type { HomeView } from '../../../application/home/home-views.js';
import type {
  AdminHomesPage,
  AdminHomesQuery,
} from '../../../application/moderation/moderation-operations.js';
import { type FieldError, ValidationFailedError } from '../problem.js';
import { accountId, type PageParams, parsePage, uuidOr404, validated } from './request-helpers.js';

export interface AdminHomeRouteOptions {
  adminListHomes: (query: AdminHomesQuery) => Promise<AdminHomesPage>;
  adminModerateHome: (adminId: string, homeId: string, input: ModerationInput) => Promise<HomeView>;
}

interface ListQuery extends PageParams {
  status?: string;
}

/** `status`, `cursor` y `limit` de `adminListHomes`; cada parámetro erróneo se señala por su nombre. */
function parseListQuery(query: ListQuery): AdminHomesQuery {
  const errors: FieldError[] = [];
  const status = query.status;
  if (status !== undefined && !(HOME_STATUSES as readonly string[]).includes(status)) {
    errors.push({ field: 'status', message: 'invalid' });
  }
  const { cursor, limit } = parsePage(query, errors);

  if (errors.length > 0) throw new ValidationFailedError(errors);
  return {
    ...(status === undefined ? {} : { status: status as HomeStatus }),
    ...(cursor === undefined ? {} : { cursor }),
    limit,
  };
}

/**
 * `adminListHomes` y `adminModerateHome` del contrato (RF-18, RF-90, RF-93). Solo transporte: la
 * política central restringe ambas al rol `admin` y los casos de uso deciden y auditan.
 */
export function adminHomeRoutes(options: AdminHomeRouteOptions): FastifyPluginCallback {
  return (app, _options, done) => {
    app.get<{ Querystring: ListQuery }>(
      '/admin/homes',
      { config: { operationId: 'adminListHomes' } },
      (request) => options.adminListHomes(parseListQuery(request.query)),
    );

    app.post<{ Params: { homeId: string } }>(
      '/admin/homes/:homeId/moderation',
      { config: { operationId: 'adminModerateHome' } },
      (request) => {
        const homeId = uuidOr404(request.params.homeId, () => new HomeNotFoundError());
        const input = validated(validateModerationInput(request.body));
        return options.adminModerateHome(accountId(request), homeId, input);
      },
    );
    done();
  };
}
