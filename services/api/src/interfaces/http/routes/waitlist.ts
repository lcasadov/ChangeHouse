import { validateWaitlistInput } from '@changehouse/shared';
import rateLimit from '@fastify/rate-limit';
import type { FastifyPluginAsync } from 'fastify';

import type { JoinWaitlistCommand } from '../../../application/waitlist/join-waitlist.js';
import { ValidationFailedError } from '../problem.js';

export interface WaitlistRouteOptions {
  joinWaitlist: (command: JoinWaitlistCommand) => Promise<unknown>;
  /** Altas permitidas por origen (IP) en cada ventana. */
  rateLimit: { max: number; windowSeconds: number };
}

const MILLISECONDS_PER_SECOND = 1000;
const TOO_MANY_REQUESTS = 429;

/** `joinWaitlist` del contrato: alta pública en la lista de espera (RF-101). */
export function waitlistRoutes(options: WaitlistRouteOptions): FastifyPluginAsync {
  return async (app) => {
    // Con `global: false` el límite solo rige en las rutas que lo piden
    await app.register(rateLimit, {
      global: false,
      // Se lanza como error para que lo traduzca el manejador único de Problem
      errorResponseBuilder: () =>
        Object.assign(new Error('Rate limit exceeded'), { statusCode: TOO_MANY_REQUESTS }),
    });

    const limit = {
      max: options.rateLimit.max,
      timeWindow: options.rateLimit.windowSeconds * MILLISECONDS_PER_SECOND,
    };
    app.post('/waitlist', { config: { rateLimit: limit } }, async (request, reply) => {
      const input = validateWaitlistInput(request.body);
      if (!input.success) {
        throw new ValidationFailedError(
          input.errors.map((error) => ({ field: error.field, message: error.code })),
        );
      }
      await options.joinWaitlist(input.data);
      // 202 también si el email ya estaba: no se revela quién está en la lista
      return reply.code(202).send();
    });
  };
}
