import {
  type HomeInput,
  type HomePatch,
  validateHomeInput,
  validateHomePatch,
} from '@changehouse/shared';
import type { FastifyPluginCallback, FastifyRequest } from 'fastify';

import { HomeNotFoundError } from '../../../application/home/errors.js';
import type { HomePublicView, HomeView } from '../../../application/home/home-views.js';
import { accountId, uuidOr404, validated } from './request-helpers.js';

export interface HomeRouteOptions {
  createHome: (userId: string, input: HomeInput) => Promise<HomeView>;
  updateHome: (userId: string, homeId: string, patch: HomePatch) => Promise<HomeView>;
  listMyHomes: (userId: string) => Promise<HomeView[]>;
  getHome: (userId: string, homeId: string) => Promise<HomeView | HomePublicView>;
  submitHome: (userId: string, homeId: string) => Promise<HomeView>;
  pauseHome: (userId: string, homeId: string) => Promise<HomeView>;
  resumeHome: (userId: string, homeId: string) => Promise<HomeView>;
}

interface HomeParams {
  homeId: string;
}

function homeIdOf(request: FastifyRequest<{ Params: HomeParams }>): string {
  return uuidOr404(request.params.homeId, () => new HomeNotFoundError());
}

/**
 * `listMyHomes`, `createHome`, `getHome`, `updateHome`, `submitHome`, `pauseHome` y `resumeHome`
 * del contrato (RF-10, RF-17, RF-20).
 * Solo transporte: la política central decide el acceso por rol y los casos de uso, la propiedad.
 */
export function homeRoutes(options: HomeRouteOptions): FastifyPluginCallback {
  return (app, _options, done) => {
    app.get('/me/homes', { config: { operationId: 'listMyHomes' } }, (request) =>
      options.listMyHomes(accountId(request)),
    );

    app.post('/homes', { config: { operationId: 'createHome' } }, async (request, reply) => {
      const input = validated(validateHomeInput(request.body));
      const home = await options.createHome(accountId(request), input);
      const collection = new URL(request.url, 'http://localhost').pathname.replace(/\/$/, '');
      return reply.code(201).header('location', `${collection}/${home.id}`).send(home);
    });

    app.get<{ Params: HomeParams }>(
      '/homes/:homeId',
      { config: { operationId: 'getHome' } },
      (request) => options.getHome(accountId(request), homeIdOf(request)),
    );

    app.patch<{ Params: HomeParams }>(
      '/homes/:homeId',
      { config: { operationId: 'updateHome' } },
      (request) => {
        const homeId = homeIdOf(request);
        const patch = validated(validateHomePatch(request.body));
        return options.updateHome(accountId(request), homeId, patch);
      },
    );

    app.post<{ Params: HomeParams }>(
      '/homes/:homeId/submit',
      { config: { operationId: 'submitHome' } },
      (request) => options.submitHome(accountId(request), homeIdOf(request)),
    );

    app.post<{ Params: HomeParams }>(
      '/homes/:homeId/pause',
      { config: { operationId: 'pauseHome' } },
      (request) => options.pauseHome(accountId(request), homeIdOf(request)),
    );

    app.post<{ Params: HomeParams }>(
      '/homes/:homeId/resume',
      { config: { operationId: 'resumeHome' } },
      (request) => options.resumeHome(accountId(request), homeIdOf(request)),
    );
    done();
  };
}
