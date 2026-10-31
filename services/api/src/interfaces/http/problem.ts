import type { IncomingMessage } from 'node:http';

import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { v7 as uuidv7 } from 'uuid';

import { DomainError, type DomainErrorKind } from '../../domain/domain-error.js';

export const CORRELATION_HEADER = 'x-correlation-id';

const PROBLEM_CONTENT_TYPE = 'application/problem+json';
const PROBLEM_TYPE_BASE = 'https://changehouse.app/problems';
// Caracteres seguros para volcar el identificador en logs y cabeceras sin inyección
const SAFE_CORRELATION_ID = /^[A-Za-z0-9._-]{1,128}$/;
const INTERNAL_ERROR_STATUS = 500;
const UNPROCESSABLE_STATUS = 422;
const CONFLICT_STATUS = 409;
const NOT_FOUND_STATUS = 404;
const BAD_REQUEST_STATUS = 400;
const TOO_MANY_REQUESTS_STATUS = 429;

/** Cómo se traduce cada clase de violación de negocio. */
const DOMAIN_STATUS: Record<DomainErrorKind, number> = {
  rule: UNPROCESSABLE_STATUS,
  conflict: CONFLICT_STATUS,
  not_found: NOT_FOUND_STATUS,
  invalid_request: BAD_REQUEST_STATUS,
  rate_limited: TOO_MANY_REQUESTS_STATUS,
};

export interface FieldError {
  field: string;
  message: string;
}

/** Datos de entrada que no cumplen el esquema; el manejador la traduce a un 400 con `errors`. */
export class ValidationFailedError extends Error {
  constructor(readonly errors: FieldError[]) {
    super('Validation failed');
    this.name = 'ValidationFailedError';
  }
}

interface ProblemKind {
  slug: string;
  title: string;
}

const PROBLEM_KINDS: Record<number, ProblemKind> = {
  400: { slug: 'validation', title: 'Datos no válidos' },
  401: { slug: 'unauthorized', title: 'No autenticado' },
  403: { slug: 'forbidden', title: 'Acceso denegado' },
  404: { slug: 'not-found', title: 'Recurso no encontrado' },
  409: { slug: 'conflict', title: 'Conflicto con el estado actual' },
  413: { slug: 'payload-too-large', title: 'Petición demasiado grande' },
  415: { slug: 'unsupported-media-type', title: 'Tipo de contenido no admitido' },
  422: { slug: 'unprocessable', title: 'Regla de negocio incumplida' },
  429: { slug: 'too-many-requests', title: 'Demasiadas peticiones' },
};
const BAD_REQUEST_KIND: ProblemKind = { slug: 'bad-request', title: 'Petición no válida' };
const INTERNAL_KIND: ProblemKind = { slug: 'internal', title: 'Error interno' };

interface Problem {
  type: string;
  title: string;
  status: number;
  code?: string;
  correlationId: string;
  errors?: FieldError[];
}

/**
 * Identificador de correlación de la petición: el de `X-Correlation-Id` si es seguro;
 * si falta o no lo es, un UUID v7 nuevo.
 */
export function generateCorrelationId(request: IncomingMessage): string {
  const received = request.headers[CORRELATION_HEADER];
  return typeof received === 'string' && SAFE_CORRELATION_ID.test(received) ? received : uuidv7();
}

function clientStatus(error: unknown): number | undefined {
  if (error instanceof ValidationFailedError) return BAD_REQUEST_STATUS;
  if (error instanceof DomainError) return DOMAIN_STATUS[error.kind];
  const status = (error as Partial<FastifyError>).statusCode;
  return status !== undefined && status >= 400 && status < INTERNAL_ERROR_STATUS
    ? status
    : undefined;
}

function buildProblem(
  status: number,
  correlationId: string,
  extra: { code?: string; errors?: FieldError[] } = {},
): Problem {
  const kind =
    status >= INTERNAL_ERROR_STATUS ? INTERNAL_KIND : (PROBLEM_KINDS[status] ?? BAD_REQUEST_KIND);
  return {
    type: `${PROBLEM_TYPE_BASE}/${kind.slug}`,
    title: kind.title,
    status,
    ...(extra.code ? { code: extra.code } : {}),
    correlationId,
    ...(extra.errors ? { errors: extra.errors } : {}),
  };
}

function sendProblem(reply: FastifyReply, problem: Problem): FastifyReply {
  return reply.code(problem.status).type(PROBLEM_CONTENT_TYPE).send(problem);
}

function extraOf(error: unknown): { code?: string; errors?: FieldError[] } {
  if (error instanceof ValidationFailedError) return { errors: error.errors };
  // Un recurso que no se puede ver responde como uno inexistente: sin código ni campos que lo distingan
  if (error instanceof DomainError && error.kind === 'not_found') return {};
  if (error instanceof DomainError) {
    const errors = error.fields.map((field) => ({ field, message: 'required' }));
    return { code: error.code, ...(errors.length > 0 ? { errors } : {}) };
  }
  return {};
}

/**
 * Responde con un `Problem` sin cuerpo de error propio, con un código estable si lo hay: lo usan
 * los hooks de seguridad.
 */
export function replyWithProblem(
  request: FastifyRequest,
  reply: FastifyReply,
  status: number,
  code?: string,
): FastifyReply {
  return sendProblem(reply, buildProblem(status, request.id, code ? { code } : {}));
}

function handleError(error: unknown, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  const status = clientStatus(error);
  if (status === undefined) {
    // El detalle va solo al registro; la respuesta nunca lo incluye
    request.log.error({ err: error }, 'Error no controlado');
    return sendProblem(reply, buildProblem(INTERNAL_ERROR_STATUS, request.id));
  }
  request.log.warn({ status }, 'Petición rechazada');
  if (error instanceof DomainError && error.retryAfterSeconds !== undefined) {
    void reply.header('Retry-After', String(error.retryAfterSeconds));
  }
  return sendProblem(reply, buildProblem(status, request.id, extraOf(error)));
}

/**
 * Formato único de error (RFC 9457): traduce validación, rutas inexistentes, límites y fallos
 * inesperados a `Problem`, y devuelve el `correlationId` también en la cabecera.
 */
export function registerProblemHandling(app: FastifyInstance): void {
  app.addHook('onRequest', (request, reply, done) => {
    void reply.header(CORRELATION_HEADER, request.id);
    done();
  });
  app.setErrorHandler(handleError);
  app.setNotFoundHandler((request, reply) => sendProblem(reply, buildProblem(404, request.id)));
}
