import rateLimit from '@fastify/rate-limit';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import type { AccountExport } from '../../../application/account/account-export.js';

export interface AccountDataRouteOptions {
  deleteMe: (userId: string) => Promise<void>;
  exportMyData: (userId: string) => Promise<AccountExport>;
  /** Exportaciones permitidas por usuario en cada ventana; por defecto 5 por hora (design.md). */
  exportRateLimit?: { max: number; windowSeconds: number };
}

const DEFAULT_EXPORT_LIMIT = { max: 5, windowSeconds: 3600 };
const MILLISECONDS_PER_SECOND = 1000;
const TOO_MANY_REQUESTS = 429;
const EXPORT_FILENAME = 'changehouse-mis-datos.json';

/** Id de la cuenta propia; la política ya garantizó que existe en estas operaciones. */
function accountId(request: FastifyRequest): string {
  const account = request.principal?.account;
  if (!account) throw new Error('La operación exige una cuenta y la política no lo comprobó');
  return account.userId;
}

/**
 * `deleteMe` y `exportMyData` del contrato: eliminar la cuenta y descargar los datos propios (RF-05).
 * Solo transporte; el acceso lo decide la política central y las reglas viven en los casos de uso.
 */
export function accountDataRoutes(options: AccountDataRouteOptions): FastifyPluginAsync {
  return async (app) => {
    // Con `global: false` el límite solo rige en las rutas que lo piden
    await app.register(rateLimit, {
      global: false,
      // Se lanza como error para que lo traduzca el manejador único de Problem
      errorResponseBuilder: () =>
        Object.assign(new Error('Rate limit exceeded'), { statusCode: TOO_MANY_REQUESTS }),
    });
    const limit = options.exportRateLimit ?? DEFAULT_EXPORT_LIMIT;

    app.delete('/me', { config: { operationId: 'deleteMe' } }, async (request, reply) => {
      await options.deleteMe(accountId(request));
      return reply.code(204).send();
    });

    app.get(
      '/me/export',
      {
        config: {
          operationId: 'exportMyData',
          rateLimit: {
            max: limit.max,
            timeWindow: limit.windowSeconds * MILLISECONDS_PER_SECOND,
            // Por usuario, no por IP: la autorización ya corrió en `onRequest`
            keyGenerator: (request: FastifyRequest) => accountId(request),
          },
        },
      },
      async (request, reply) => {
        const data = await options.exportMyData(accountId(request));
        return reply
          .header('content-disposition', `attachment; filename="${EXPORT_FILENAME}"`)
          .send(data);
      },
    );
  };
}
