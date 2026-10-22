import * as Sentry from '@sentry/node';
import type { FastifyInstance } from 'fastify';

/**
 * Recolección mínima (RGPD): sin usuario, cookies, cabeceras, cuerpos, parámetros de URL ni
 * datos de consultas, colas o IA; solo el error y su traza.
 */
export const MINIMAL_DATA_COLLECTION: NonNullable<Sentry.NodeOptions['dataCollection']> = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  genAI: { inputs: false, outputs: false },
  stackFrameVariables: false,
};

/**
 * Inicializa Sentry solo si hay DSN (`SENTRY_DSN`); sin él no hace nada.
 */
export function initSentry(env: NodeJS.ProcessEnv = process.env): boolean {
  const dsn = env['SENTRY_DSN'];
  if (!dsn) return false;
  Sentry.init({
    dsn,
    dataCollection: MINIMAL_DATA_COLLECTION,
    ...(env['NODE_ENV'] ? { environment: env['NODE_ENV'] } : {}),
  });
  return true;
}

/** Enlaza el manejador de errores de Fastify con Sentry. Llamar solo si `initSentry` devolvió `true`. */
export function instrumentFastify(app: FastifyInstance): void {
  Sentry.setupFastifyErrorHandler(app);
}
