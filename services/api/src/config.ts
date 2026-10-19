export interface ApiConfig {
  port: number;
  databaseUrl: string;
  /** Único origen que puede llamar a la API desde un navegador (CORS). */
  landingOrigin: string;
  /** Orígenes de la app web que pueden llamar a la API con credenciales (CORS). */
  appOrigins: string[];
  /** Saltos de proxy de confianza para obtener la IP real del cliente. */
  trustProxyHops: number;
  waitlistRateLimit: { max: number; windowSeconds: number };
  firebase: {
    /** Proyecto de Firebase cuyos ID tokens acepta la API (`aud` e `iss`). */
    projectId: string;
    /** `host:puerto` del emulador de Auth. Solo en local y en las pruebas. */
    authEmulatorHost: string | undefined;
  };
  /** `false` en pruebas; las pruebas pasan un destino propio para inspeccionar el registro. */
  logger: boolean | { level: string; stream: { write(line: string): void } };
}

type Env = Readonly<Record<string, string | undefined>>;

const DEFAULT_PORT = 8080;
const DEFAULT_LANDING_ORIGIN = 'http://localhost:4321'; // `astro dev`
const DEFAULT_APP_ORIGIN = 'http://localhost:8081'; // `expo start --web`
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

function origins(env: Env, name: string, fallback: string): string[] {
  const list = (env[name] ?? fallback).split(',').map((item) => item.trim());
  return list.filter((item) => item !== '').map((item) => origin({ [name]: item }, name, item));
}

/** Lee y valida la configuración del entorno; falla al arrancar si algo no es válido. */
export function loadConfig(env: Env = process.env): ApiConfig {
  const databaseUrl = env['DATABASE_URL'];
  if (!databaseUrl) throw new Error('Falta la variable DATABASE_URL');

  const projectId = env['FIREBASE_PROJECT_ID'];
  if (!projectId) throw new Error('Falta la variable FIREBASE_PROJECT_ID');
  const authEmulatorHost = env['FIREBASE_AUTH_EMULATOR_HOST'] || undefined;
  // El emulador emite tokens sin firma: en Cloud Run abriría la API a cualquiera
  if (authEmulatorHost && env['K_SERVICE']) {
    throw new Error('FIREBASE_AUTH_EMULATOR_HOST no puede definirse en Cloud Run');
  }

  return {
    port: integer(env, 'PORT', DEFAULT_PORT, 0),
    databaseUrl,
    landingOrigin: origin(env, 'LANDING_ORIGIN', DEFAULT_LANDING_ORIGIN),
    appOrigins: origins(env, 'APP_ORIGIN', DEFAULT_APP_ORIGIN),
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
    firebase: { projectId, authEmulatorHost },
    logger: env['NODE_ENV'] !== 'test',
  };
}
