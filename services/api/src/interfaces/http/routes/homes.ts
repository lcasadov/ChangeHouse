import {
  type HomeInput,
  type HomePatch,
  validateHomeInput,
  validateHomePatch,
  type Validation,
} from '@changehouse/shared';
import type { FastifyPluginCallback, FastifyRequest } from 'fastify';

import { HomeNotFoundError } from '../../../application/home/errors.js';
import type { HomePublicView, HomeView } from '../../../application/home/home-views.js';
import { ValidationFailedError } from '../problem.js';

export interface HomeRouteOptions {
  createHome: (userId: string, input: HomeInput) => Promise<HomeView>;
  updateHome: (userId: string, homeId: string, patch: HomePatch) => Promise<HomeView>;
  listMyHomes: (userId: string) => Promise<HomeView[]>;
  getHome: (userId: string, homeId: string) => Promise<HomeView | HomePublicView>;
  submitHome: (userId: string, homeId: string) => Promise<HomeView>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface HomeParams {
  homeId: string;
}

/** Datos válidos o un 400 con los campos erróneos. */
function validated<T>(result: Validation<T>): T {
  if (result.success) return result.data;
  throw new ValidationFailedError(
    result.errors.map((error) => ({ field: error.field, message: error.code })),
  );
}

/** Id de la cuenta propia; la política ya garantizó que existe en las operaciones que lo piden. */
function accountId(request: FastifyRequest): string {
  const account = request.principal?.account;
  if (!account) throw new Error('La operación exige una cuenta y la política no lo comprobó');
  return account.userId;
}

/** Un identificador que no es un UUID responde igual que uno que no existe: sin consultar nada. */
function homeIdOf(request: FastifyRequest<{ Params: HomeParams }>): string {
  const { homeId } = request.params;
  if (!UUID.test(homeId)) throw new HomeNotFoundError();
  return homeId;
}

/**
 * `listMyHomes`, `createHome`, `getHome`, `updateHome` y `submitHome` del contrato (RF-10, RF-20).
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
    done();
  };
}
