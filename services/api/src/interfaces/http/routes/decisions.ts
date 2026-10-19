import type { FastifyPluginCallback } from 'fastify';

import type {
  DismissCommand,
  LikeCommand,
  LikeResult,
} from '../../../application/decision/decision-operations.js';
import { HomeNotFoundError } from '../../../application/home/errors.js';
import { type FieldError, ValidationFailedError } from '../problem.js';
import { accountId, isUuid, uuidOr404 } from './request-helpers.js';

export interface DecisionRouteOptions {
  likeHome: (userId: string, command: LikeCommand) => Promise<LikeResult>;
  dismissHome: (userId: string, command: DismissCommand) => Promise<void>;
  undoLastAction: (userId: string, homeId: string | undefined) => Promise<void>;
}

interface UndoQuerystring {
  homeId?: string;
}

/** El cuerpo como objeto con solo los campos permitidos (`additionalProperties: false`). */
function bodyFields(body: unknown, allowed: readonly string[], errors: FieldError[]) {
  const object = typeof body === 'object' && body !== null && !Array.isArray(body);
  const fields: Record<string, unknown> = object ? { ...(body as Record<string, unknown>) } : {};
  for (const key of Object.keys(fields)) {
    if (!allowed.includes(key)) errors.push({ field: key, message: 'unknown' });
  }
  return fields;
}

/** Un identificador del cuerpo: obligatorio u opcional, y siempre un UUID. */
function uuidField(
  fields: Record<string, unknown>,
  name: string,
  required: boolean,
  errors: FieldError[],
): string | undefined {
  const value = fields[name];
  if (value === undefined) {
    if (required) errors.push({ field: name, message: 'required' });
    return undefined;
  }
  if (typeof value !== 'string' || !isUuid(value)) {
    errors.push({ field: name, message: 'invalid' });
    return undefined;
  }
  return value;
}

function parseLike(body: unknown): LikeCommand {
  const errors: FieldError[] = [];
  const fields = bodyFields(body, ['fromHomeId', 'targetHomeId'], errors);
  const fromHomeId = uuidField(fields, 'fromHomeId', true, errors);
  const targetHomeId = uuidField(fields, 'targetHomeId', true, errors);
  if (errors.length > 0 || fromHomeId === undefined || targetHomeId === undefined) {
    throw new ValidationFailedError(errors);
  }
  return { fromHomeId, targetHomeId };
}

function parseDismiss(body: unknown): DismissCommand {
  const errors: FieldError[] = [];
  const fields = bodyFields(body, ['fromHomeId', 'targetHomeId'], errors);
  const fromHomeId = uuidField(fields, 'fromHomeId', false, errors);
  const targetHomeId = uuidField(fields, 'targetHomeId', true, errors);
  if (errors.length > 0 || targetHomeId === undefined) throw new ValidationFailedError(errors);
  return { ...(fromHomeId === undefined ? {} : { fromHomeId }), targetHomeId };
}

/**
 * `likeHome`, `dismissHome` y `undoLastAction` del contrato (RF-41, RF-44, RF-45). Solo transporte: la
 * política central decide el acceso por rol; los casos de uso, la propiedad y las reglas de negocio.
 */
export function decisionRoutes(options: DecisionRouteOptions): FastifyPluginCallback {
  return (app, _options, done) => {
    app.post('/me/likes', { config: { operationId: 'likeHome' } }, async (request, reply) => {
      const command = parseLike(request.body);
      return reply.code(201).send(await options.likeHome(accountId(request), command));
    });

    app.post(
      '/me/dismissals',
      { config: { operationId: 'dismissHome' } },
      async (request, reply) => {
        const command = parseDismiss(request.body);
        await options.dismissHome(accountId(request), command);
        return reply.code(204).send();
      },
    );

    app.delete<{ Querystring: UndoQuerystring }>(
      '/me/last-action',
      { config: { operationId: 'undoLastAction' } },
      async (request, reply) => {
        const { homeId } = request.query;
        const checked =
          homeId === undefined ? undefined : uuidOr404(homeId, () => new HomeNotFoundError());
        await options.undoLastAction(accountId(request), checked);
        return reply.code(204).send();
      },
    );
    done();
  };
}
