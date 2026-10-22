import { type SearchPreferencesInput, validateSearchPreferences } from '@changehouse/shared';
import type { FastifyPluginCallback, FastifyRequest } from 'fastify';

import { HomeNotFoundError } from '../../../application/home/errors.js';
import type { SearchPreferencesView } from '../../../application/search-preferences/search-preferences-views.js';
import { accountId, uuidOr404, validated } from './request-helpers.js';

export interface SearchPreferencesRouteOptions {
  getMySearchPreferences: (userId: string) => Promise<SearchPreferencesView>;
  putMySearchPreferences: (
    userId: string,
    input: SearchPreferencesInput,
  ) => Promise<SearchPreferencesView>;
  getHomeSearchPreferences: (userId: string, homeId: string) => Promise<SearchPreferencesView>;
  putHomeSearchPreferences: (
    userId: string,
    homeId: string,
    input: SearchPreferencesInput,
  ) => Promise<SearchPreferencesView>;
  deleteHomeSearchPreferences: (userId: string, homeId: string) => Promise<void>;
}

interface HomeParams {
  homeId: string;
}

function homeIdOf(request: FastifyRequest<{ Params: HomeParams }>): string {
  return uuidOr404(request.params.homeId, () => new HomeNotFoundError());
}

/**
 * Las cinco operaciones `*SearchPreferences` del contrato (RF-30 a RF-33). Solo transporte: la
 * política central decide el acceso por rol y los casos de uso, la propiedad de la vivienda.
 */
export function searchPreferencesRoutes(
  options: SearchPreferencesRouteOptions,
): FastifyPluginCallback {
  return (app, _options, done) => {
    app.get(
      '/me/search-preferences',
      { config: { operationId: 'getMySearchPreferences' } },
      (request) => options.getMySearchPreferences(accountId(request)),
    );

    app.put(
      '/me/search-preferences',
      { config: { operationId: 'putMySearchPreferences' } },
      (request) => {
        const input = validated(validateSearchPreferences(request.body));
        return options.putMySearchPreferences(accountId(request), input);
      },
    );

    app.get<{ Params: HomeParams }>(
      '/homes/:homeId/search-preferences',
      { config: { operationId: 'getHomeSearchPreferences' } },
      (request) => options.getHomeSearchPreferences(accountId(request), homeIdOf(request)),
    );

    app.put<{ Params: HomeParams }>(
      '/homes/:homeId/search-preferences',
      { config: { operationId: 'putHomeSearchPreferences' } },
      (request) => {
        const homeId = homeIdOf(request);
        const input = validated(validateSearchPreferences(request.body));
        return options.putHomeSearchPreferences(accountId(request), homeId, input);
      },
    );

    app.delete<{ Params: HomeParams }>(
      '/homes/:homeId/search-preferences',
      { config: { operationId: 'deleteHomeSearchPreferences' } },
      async (request, reply) => {
        await options.deleteHomeSearchPreferences(accountId(request), homeIdOf(request));
        return reply.code(204).send();
      },
    );
    done();
  };
}
