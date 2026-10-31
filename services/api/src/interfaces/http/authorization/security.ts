import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { InvalidTokenError } from '../../../application/auth/identity-verifier.js';
import type { Principal } from '../../../application/auth/principal.js';
import { replyWithProblem } from '../problem.js';
import {
  ACCOUNT_SUSPENDED,
  type Actor,
  decide,
  type Decision,
  type Policy,
  policy as defaultPolicy,
} from './policy.js';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** `operationId` del contrato; la política de autorización se busca por él. */
    operationId?: string;
  }
  interface FastifyRequest {
    /** Quién hace la petición; `null` en las operaciones públicas. */
    principal: Principal | null;
  }
  interface FastifyInstance {
    /** `operationId` de todas las rutas registradas (las operaciones implementadas). */
    operations: ReadonlySet<string>;
  }
}

export interface SecurityOptions {
  /** Del ID token al principal; lanza `InvalidTokenError` si el token no vale. */
  authenticate?: (token: string) => Promise<Principal>;
  /** Solo para pruebas: por defecto rige la política del proyecto. */
  policy?: Policy;
}

const FORBIDDEN = 403;
const UNAUTHORIZED = 401;
const BEARER = /^Bearer\s+(\S+)$/i;

/** Sin configuración de seguridad nada se autentica: la API se cierra, no se abre. */
const rejectEverything: (token: string) => Promise<Principal> = () =>
  Promise.reject(new InvalidTokenError());

function bearerToken(header: string | undefined): string | undefined {
  return header === undefined ? undefined : BEARER.exec(header)?.[1];
}

function actorOf(principal: Principal): Actor {
  return principal.account?.role ?? 'unregistered';
}

function isSuspended(principal: Principal): boolean {
  return principal.account?.suspended ?? false;
}

/** Una identidad no verificable es «sin autenticar»; un fallo técnico no se disfraza de 401. */
async function authenticateOrNull(
  authenticate: (token: string) => Promise<Principal>,
  token: string | undefined,
): Promise<Principal | null> {
  if (token === undefined) return null;
  try {
    return await authenticate(token);
  } catch (error) {
    if (error instanceof InvalidTokenError) return null;
    throw error;
  }
}

function deny(
  request: FastifyRequest,
  reply: FastifyReply,
  status: number,
  code?: string,
): FastifyReply {
  if (status === UNAUTHORIZED) void reply.header('www-authenticate', 'Bearer');
  return replyWithProblem(request, reply, status, code);
}

function logDenial(
  request: FastifyRequest,
  operationId: string | undefined,
  status: number,
  code?: string,
): void {
  // Nunca el token ni datos personales: solo con qué operación y quién (identificador interno)
  const context = { status, operationId, userId: request.principal?.account?.userId };
  if (code === ACCOUNT_SUSPENDED) {
    request.log.warn({ event: 'auth.suspended', ...context }, 'Cuenta suspendida');
  } else if (status === UNAUTHORIZED) {
    request.log.warn(
      { event: 'auth.unauthenticated', status, route: request.routeOptions.url, ip: request.ip },
      'Petición sin autenticar',
    );
  } else if (status === FORBIDDEN) {
    request.log.warn({ event: 'auth.forbidden', ...context }, 'Acceso denegado');
  } else {
    request.log.info({ event: 'auth.not-found', ...context }, 'Recurso no visible para el usuario');
  }
}

/**
 * Autenticación y autorización de toda la API, en un único punto. Cada petición se resuelve por el
 * `operationId` de su ruta contra la política: lo público pasa, lo demás exige un token válido, y
 * lo que no tiene regla se deniega. Corre en `onRequest`, antes de leer el cuerpo.
 */
export function registerSecurity(app: FastifyInstance, options?: SecurityOptions): void {
  const authenticate = options?.authenticate ?? rejectEverything;
  const rules = options?.policy ?? defaultPolicy;
  const operations = new Set<string>();

  app.decorate('operations', operations);
  app.decorateRequest('principal', null);
  app.addHook('onRoute', (route) => {
    const operationId = route.config?.operationId;
    if (operationId !== undefined) operations.add(operationId);
  });

  app.addHook('onRequest', async (request, reply) => {
    // Las rutas que no existen siguen siendo 404; la precarga CORS la contesta el propio plugin
    if (request.is404 || request.method === 'OPTIONS') return;

    const operationId = request.routeOptions.config?.operationId;
    const access = operationId === undefined ? undefined : rules[operationId];
    if (access?.kind === 'public') return;

    const principal = await authenticateOrNull(
      authenticate,
      bearerToken(request.headers.authorization),
    );
    if (principal === null) {
      logDenial(request, operationId, UNAUTHORIZED);
      return deny(request, reply, UNAUTHORIZED);
    }
    request.principal = principal;

    // Una operación sin regla se deniega: nada se permite por omisión
    const decision: Decision = access
      ? decide(access, actorOf(principal), isSuspended(principal))
      : { allowed: false, status: FORBIDDEN };
    if (decision.allowed) return;
    logDenial(request, operationId, decision.status, decision.code);
    return deny(request, reply, decision.status, decision.code);
  });
}
