import cors, { type FastifyCorsOptionsDelegate } from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyServerOptions, LogController } from 'fastify';

import { registerSecurity, type SecurityOptions } from './authorization/security.js';
import { generateCorrelationId, registerProblemHandling } from './problem.js';
import { type AccountRouteOptions, accountRoutes } from './routes/accounts.js';
import { type HomeRouteOptions, homeRoutes } from './routes/homes.js';
import { type PhotoRouteOptions, photoRoutes } from './routes/photos.js';
import { type WaitlistRouteOptions, waitlistRoutes } from './routes/waitlist.js';

export interface AppOptions {
  logger?: FastifyServerOptions['logger'];
  /** Origen de la landing: el único al que se permite CORS. Sin él, CORS queda desactivado. */
  landingOrigin?: string;
  /** Orígenes de la app web: pueden leer y escribir con `Authorization`. Sin ellos, solo la landing. */
  appOrigins?: readonly string[];
  /** Saltos de proxy de confianza para leer la IP real del cliente. */
  trustProxyHops?: number;
  /** Autenticación y política de autorización. Sin ella, ninguna operación protegida responde. */
  security?: SecurityOptions;
  waitlist?: WaitlistRouteOptions;
  accounts?: AccountRouteOptions;
  homes?: HomeRouteOptions;
  photos?: PhotoRouteOptions;
}

/** Confía solo en los `hops` saltos más cercanos: la IP real es la que añadió el último proxy. */
function trustProxyFor(hops: number): FastifyServerOptions['trustProxy'] {
  return hops > 0 ? (_address, hop) => hop < hops : false;
}

/** Prefijo de versión de la API; coincide con el de `servers` en `docs/api/openapi.yaml`. */
const API_PREFIX = '/v1';

const LANDING_CORS = {
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Correlation-Id'],
};
const APP_CORS = {
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Correlation-Id'],
};

/** Mínimo privilegio por origen: la landing solo envía altas; la app usa el token y todos los métodos. */
function registerCors(
  app: FastifyInstance,
  landingOrigin: string | undefined,
  appOrigins: readonly string[],
): void {
  if (!landingOrigin && appOrigins.length === 0) return;
  const delegate: FastifyCorsOptionsDelegate = (request, callback) => {
    const origin = request.headers.origin;
    const fromApp = origin !== undefined && appOrigins.includes(origin);
    const profile = fromApp ? APP_CORS : LANDING_CORS;
    callback(null, {
      ...profile,
      origin: fromApp || (origin !== undefined && origin === landingOrigin),
      exposedHeaders: ['Retry-After', 'X-Correlation-Id'],
    });
  };
  void app.register(cors, () => delegate);
}

/**
 * Construye la instancia de Fastify con el formato único de error y la correlación de
 * peticiones. Los endpoints salen de `docs/api/openapi.yaml` y se añaden con cada change.
 */
export function buildApp(options: AppOptions = {}): FastifyInstance {
  const logger = options.logger ?? process.env['NODE_ENV'] !== 'test';
  const app = Fastify({
    // Defensa en profundidad: aunque se registrasen las cabeceras, el token no se escribe
    logger: logger === true ? { redact: ['req.headers.authorization'] } : logger,
    genReqId: generateCorrelationId,
    // El identificador de la petición es el de correlación: aparece así en cada línea de log
    logController: new LogController({ requestIdLogLabel: 'correlationId' }),
    trustProxy: trustProxyFor(options.trustProxyHops ?? 0),
  });
  registerProblemHandling(app);

  registerCors(app, options.landingOrigin, options.appOrigins ?? []);
  // Tras CORS, para que su hook `onRequest` corra antes: sin él, un 401/403/404 llegaría al
  // navegador sin cabeceras CORS y la app lo vería como un fallo de red, no como la respuesta real
  app.after(() => {
    registerSecurity(app, options.security);
  });
  // Las operaciones de negocio cuelgan de `/v1` (`servers` de docs/api/openapi.yaml); lo demás es 404
  void app.register(
    async (versioned) => {
      if (options.waitlist) await versioned.register(waitlistRoutes(options.waitlist));
      if (options.accounts) await versioned.register(accountRoutes(options.accounts));
      if (options.homes) await versioned.register(homeRoutes(options.homes));
      if (options.photos) await versioned.register(photoRoutes(options.photos));
    },
    { prefix: API_PREFIX },
  );
  return app;
}
