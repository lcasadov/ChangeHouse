import {
  type BlockUserInput,
  type ReportInput,
  validateBlockUserInput,
  validateReportInput,
} from '@changehouse/shared';
import rateLimit from '@fastify/rate-limit';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import type { ReportView } from '../../../application/moderation/report-operations.js';
import { accountId, validated } from './request-helpers.js';

export interface ReportRouteOptions {
  createReport: (reporterId: string, input: ReportInput) => Promise<ReportView>;
  blockUser: (blockerId: string, blockedId: BlockUserInput['userId']) => Promise<void>;
  /** Denuncias permitidas por usuario en cada ventana; por defecto 10 por hora (design.md). */
  reportRateLimit?: { max: number; windowSeconds: number };
}

const DEFAULT_REPORT_LIMIT = { max: 10, windowSeconds: 3600 };
const MILLISECONDS_PER_SECOND = 1000;
const TOO_MANY_REQUESTS = 429;

/**
 * `createReport` y `blockUser` del contrato (RF-63). Solo transporte: la política central restringe
 * ambas a `owner` y `seeker`, y los casos de uso comprueban el objetivo.
 */
export function reportRoutes(options: ReportRouteOptions): FastifyPluginAsync {
  return async (app) => {
    // Con `global: false` el límite solo rige en las rutas que lo piden
    await app.register(rateLimit, {
      global: false,
      // Se lanza como error para que lo traduzca el manejador único de Problem
      errorResponseBuilder: () =>
        Object.assign(new Error('Rate limit exceeded'), { statusCode: TOO_MANY_REQUESTS }),
    });
    const limit = options.reportRateLimit ?? DEFAULT_REPORT_LIMIT;

    app.post(
      '/reports',
      {
        config: {
          operationId: 'createReport',
          rateLimit: {
            max: limit.max,
            timeWindow: limit.windowSeconds * MILLISECONDS_PER_SECOND,
            // Por usuario, no por IP: la autorización ya corrió en `onRequest`
            keyGenerator: (request: FastifyRequest) => accountId(request),
          },
        },
      },
      async (request, reply) => {
        const input = validated(validateReportInput(request.body));
        const report = await options.createReport(accountId(request), input);
        return reply.code(201).send(report);
      },
    );

    app.post(
      '/me/blocked-users',
      { config: { operationId: 'blockUser' } },
      async (request, reply) => {
        const { userId } = validated(validateBlockUserInput(request.body));
        await options.blockUser(accountId(request), userId);
        return reply.code(204).send();
      },
    );
  };
}
