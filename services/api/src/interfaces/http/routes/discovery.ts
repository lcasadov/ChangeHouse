import type { FastifyPluginCallback } from 'fastify';

import type {
  DiscoverQuery,
  DiscoveryPage,
} from '../../../application/discovery/discovery-operations.js';
import { HomeNotFoundError } from '../../../application/home/errors.js';
import { type FieldError, ValidationFailedError } from '../problem.js';
import { accountId, type PageParams, parsePage, uuidOr404 } from './request-helpers.js';

export interface DiscoveryRouteOptions {
  discoverHomes: (userId: string, query: DiscoverQuery) => Promise<DiscoveryPage>;
}

interface DiscoverQueryString extends PageParams {
  homeId?: string;
}

/**
 * `homeId`, `cursor` y `limit`. Un `homeId` que no es un UUID responde como una vivienda que no
 * existe (404), igual que en las rutas con la vivienda en el camino.
 */
function parseDiscoverQuery(query: DiscoverQueryString): DiscoverQuery {
  const errors: FieldError[] = [];
  const { cursor, limit } = parsePage(query, errors);
  if (errors.length > 0) throw new ValidationFailedError(errors);
  const homeId =
    query.homeId === undefined ? undefined : uuidOr404(query.homeId, () => new HomeNotFoundError());
  return {
    ...(homeId === undefined ? {} : { homeId }),
    ...(cursor === undefined ? {} : { after: cursor }),
    limit,
  };
}

/**
 * `discoverHomes` del contrato (RF-40, RF-44, RN-06, RN-11). Solo transporte: la política central
 * restringe a `owner` y `seeker`, y el caso de uso decide la vivienda, las preferencias y las tarjetas.
 */
export function discoveryRoutes(options: DiscoveryRouteOptions): FastifyPluginCallback {
  return (app, _options, done) => {
    app.get<{ Querystring: DiscoverQueryString }>(
      '/discover',
      { config: { operationId: 'discoverHomes' } },
      (request) => options.discoverHomes(accountId(request), parseDiscoverQuery(request.query)),
    );
    done();
  };
}
