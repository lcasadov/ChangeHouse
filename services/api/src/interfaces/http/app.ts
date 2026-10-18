import Fastify, { type FastifyInstance } from 'fastify';

/**
 * Construye la instancia de Fastify. Aún no registra rutas: los endpoints
 * salen de `docs/api/openapi.yaml` y se añaden con cada change.
 */
export function buildApp(): FastifyInstance {
  return Fastify({ logger: process.env['NODE_ENV'] !== 'test' });
}
