import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyServerOptions, LogController } from 'fastify';

import { generateCorrelationId, registerProblemHandling } from './problem.js';
import { type WaitlistRouteOptions, waitlistRoutes } from './routes/waitlist.js';

export interface AppOptions {
  logger?: FastifyServerOptions['logger'];
  /** Origen de la landing: el único al que se permite CORS. Sin él, CORS queda desactivado. */
  landingOrigin?: string;
  /** Saltos de proxy de confianza para leer la IP real del cliente. */
  trustProxyHops?: number;
  waitlist?: WaitlistRouteOptions;
}

/** Confía solo en los `hops` saltos más cercanos: la IP real es la que añadió el último proxy. */
function trustProxyFor(hops: number): FastifyServerOptions['trustProxy'] {
  return hops > 0 ? (_address, hop) => hop < hops : false;
}

/**
 * Construye la instancia de Fastify con el formato único de error y la correlación de
 * peticiones. Los endpoints salen de `docs/api/openapi.yaml` y se añaden con cada change.
 */
export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? process.env['NODE_ENV'] !== 'test',
    genReqId: generateCorrelationId,
    // El identificador de la petición es el de correlación: aparece así en cada línea de log
    logController: new LogController({ requestIdLogLabel: 'correlationId' }),
    trustProxy: trustProxyFor(options.trustProxyHops ?? 0),
  });
  registerProblemHandling(app);

  if (options.landingOrigin) {
    void app.register(cors, {
      origin: [options.landingOrigin],
      methods: ['POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Correlation-Id'],
      exposedHeaders: ['Retry-After', 'X-Correlation-Id'],
    });
  }
  if (options.waitlist) void app.register(waitlistRoutes(options.waitlist));
  return app;
}
