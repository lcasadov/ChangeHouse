export interface ApiConfig {
  port: number;
  databaseUrl: string;
  /** Único origen que puede llamar a la API desde un navegador (CORS). */
  landingOrigin: string;
  /** Saltos de proxy de confianza para obtener la IP real del cliente. */
  trustProxyHops: number;
  waitlistRateLimit: { max: number; windowSeconds: number };
  logger: boolean;
}

type Env = Readonly<Record<string, string | undefined>>;

const DEFAULT_PORT = 8080;
const DEFAULT_LANDING_ORIGIN = 'http://localhost:4321'; // `astro dev`
const DEFAULT_WAITLIST_MAX = 5;
const DEFAULT_WAITLIST_WINDOW_SECONDS = 600; // 10 minutos
const CLOUD_RUN_PROXY_HOPS = 1;

function integer(env: Env, name: string, fallback: number, minimum: number): number {
  const raw = env[name];
  if (raw === undefined) return fallback;
  const value = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`La variable ${name} debe ser un entero mayor o igual que ${String(minimum)}`);
  }
  return value;
}

function origin(env: Env, name: string, fallback: string): string {
  const raw = env[name] ?? fallback;
  const valid = URL.canParse(raw) && new URL(raw).origin === raw;
  if (!valid) throw new Error(`La variable ${name} debe ser un origen (esquema, host y puerto)`);
  return raw;
}

/** Lee y valida la configuración del entorno; falla al arrancar si algo no es válido. */
export function loadConfig(env: Env = process.env): ApiConfig {
  const databaseUrl = env['DATABASE_URL'];
  if (!databaseUrl) throw new Error('Falta la variable DATABASE_URL');

  return {
    port: integer(env, 'PORT', DEFAULT_PORT, 0),
    databaseUrl,
    landingOrigin: origin(env, 'LANDING_ORIGIN', DEFAULT_LANDING_ORIGIN),
    // Cloud Run añade la IP del cliente al final de X-Forwarded-For: se confía solo en ese salto
    trustProxyHops: integer(
      env,
      'TRUST_PROXY_HOPS',
      env['K_SERVICE'] ? CLOUD_RUN_PROXY_HOPS : 0,
      0,
    ),
    waitlistRateLimit: {
      max: integer(env, 'WAITLIST_RATE_LIMIT_MAX', DEFAULT_WAITLIST_MAX, 1),
      windowSeconds: integer(env, 'WAITLIST_RATE_LIMIT_WINDOW', DEFAULT_WAITLIST_WINDOW_SECONDS, 1),
    },
    logger: env['NODE_ENV'] !== 'test',
  };
}
