export interface ApiConfig {
  port: number;
  databaseUrl: string;
  /** Único origen que puede llamar a la API desde un navegador (CORS). */
  landingOrigin: string;
  /** Orígenes de la app web que pueden llamar a la API con credenciales (CORS). */
  appOrigins: string[];
  /** URL pública de la app (sin barra final): base de los enlaces de los emails, `<url>/match/<id>`. */
  appPublicUrl: string;
  /** Saltos de proxy de confianza para obtener la IP real del cliente. */
  trustProxyHops: number;
  waitlistRateLimit: { max: number; windowSeconds: number };
  /** Me gusta permitidos por usuario y día natural de Madrid, sumando todas sus viviendas (RF-45). */
  likesPerDay: number;
  firebase: {
    /** Proyecto de Firebase cuyos ID tokens acepta la API (`aud` e `iss`). */
    projectId: string;
    /** `host:puerto` del emulador de Auth. Solo en local y en las pruebas. */
    authEmulatorHost: string | undefined;
    /** `host:puerto` del emulador de Firestore (chat). Solo en local y en las pruebas. */
    firestoreEmulatorHost: string | undefined;
  };
  /** Reintento periódico de los hechos pendientes de la bandeja de salida (creación de chats). */
  outbox: { intervalSeconds: number };
  /** Clave AES-256 (base64, 32 bytes) con la que se cifra la dirección postal de las viviendas. */
  addressEncryptionKey: string;
  places: {
    /** Clave de servidor de Google Places. Sin ella (solo en local) rigen los lugares de prueba. */
    serverKey: string | undefined;
  };
  storage: {
    /** Bucket privado y temporal de los originales subidos con URL firmada. */
    privateBucket: string;
    /** Bucket público de las fotos ya procesadas. */
    publicBucket: string;
    /** Base de la URL pública de las fotos (sin barra final): la CDN, o el bucket público directamente. */
    publicBaseUrl: string;
    /** `host:puerto` de fake-gcs-server. Solo en local y en las pruebas. */
    emulatorHost: string | undefined;
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
const DEFAULT_LIKES_PER_DAY = 10;
const DEFAULT_OUTBOX_INTERVAL_SECONDS = 30;
const CLOUD_RUN_PROXY_HOPS = 1;
const DEFAULT_PRIVATE_BUCKET = 'changehouse-photos-private'; // docker-compose.yml
const DEFAULT_PUBLIC_BUCKET = 'changehouse-photos-public'; // docker-compose.yml

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

/** URL http(s) sin barra final. Obligatoria en Cloud Run; en local, la de `expo start --web`. */
function publicUrl(env: Env, name: string, fallback: string): string {
  const raw = env[name] ?? (env['K_SERVICE'] ? undefined : fallback);
  if (raw === undefined) throw new Error(`Falta la variable ${name} en Cloud Run`);
  const valid = URL.canParse(raw) && /^https?:$/.test(new URL(raw).protocol);
  if (!valid) throw new Error(`La variable ${name} debe ser una URL http o https`);
  return raw.replace(/\/+$/, '');
}

function origins(env: Env, name: string, fallback: string): string[] {
  const list = (env[name] ?? fallback).split(',').map((item) => item.trim());
  return list.filter((item) => item !== '').map((item) => origin({ [name]: item }, name, item));
}

/** Los buckets de las fotos: obligatorios en Cloud Run; en local, los de docker-compose. */
function bucket(env: Env, name: string, fallback: string): string {
  const value = env[name] || undefined;
  if (value) return value;
  if (env['K_SERVICE']) throw new Error(`Falta la variable ${name} en Cloud Run`);
  return fallback;
}

function storageConfig(env: Env): ApiConfig['storage'] {
  const emulatorHost = env['STORAGE_EMULATOR_HOST'] || undefined;
  // El emulador no valida las URL firmadas: en Cloud Run guardaría las fotos en un servidor falso
  if (emulatorHost && env['K_SERVICE']) {
    throw new Error('STORAGE_EMULATOR_HOST no puede definirse en Cloud Run');
  }
  const privateBucket = bucket(env, 'STORAGE_PRIVATE_BUCKET', DEFAULT_PRIVATE_BUCKET);
  const publicBucket = bucket(env, 'STORAGE_PUBLIC_BUCKET', DEFAULT_PUBLIC_BUCKET);
  const custom = env['STORAGE_PUBLIC_BASE_URL'] || undefined;
  if (custom !== undefined && !URL.canParse(custom)) {
    throw new Error('La variable STORAGE_PUBLIC_BASE_URL debe ser una URL');
  }
  const bucketUrl = emulatorHost
    ? `http://${emulatorHost}/${publicBucket}`
    : `https://storage.googleapis.com/${publicBucket}`;
  return {
    privateBucket,
    publicBucket,
    publicBaseUrl: (custom ?? bucketUrl).replace(/\/+$/, ''),
    emulatorHost,
  };
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

  const firestoreEmulatorHost = env['FIRESTORE_EMULATOR_HOST'] || undefined;
  // El emulador no aplica las reglas de producción: en Cloud Run escribiría el chat en un servidor falso
  if (firestoreEmulatorHost && env['K_SERVICE']) {
    throw new Error('FIRESTORE_EMULATOR_HOST no puede definirse en Cloud Run');
  }

  const addressEncryptionKey = env['ADDRESS_ENCRYPTION_KEY'];
  if (!addressEncryptionKey) throw new Error('Falta la variable ADDRESS_ENCRYPTION_KEY');
  const placesServerKey = env['GOOGLE_PLACES_SERVER_KEY'] || undefined;
  // Sin clave en Cloud Run, las direcciones se resolverían contra el catálogo de prueba
  if (!placesServerKey && env['K_SERVICE']) {
    throw new Error('Falta la variable GOOGLE_PLACES_SERVER_KEY en Cloud Run');
  }

  return {
    port: integer(env, 'PORT', DEFAULT_PORT, 0),
    databaseUrl,
    landingOrigin: origin(env, 'LANDING_ORIGIN', DEFAULT_LANDING_ORIGIN),
    appOrigins: origins(env, 'APP_ORIGIN', DEFAULT_APP_ORIGIN),
    appPublicUrl: publicUrl(env, 'APP_PUBLIC_URL', DEFAULT_APP_ORIGIN),
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
    likesPerDay: integer(env, 'LIKES_PER_DAY', DEFAULT_LIKES_PER_DAY, 1),
    firebase: { projectId, authEmulatorHost, firestoreEmulatorHost },
    outbox: {
      intervalSeconds: integer(env, 'OUTBOX_INTERVAL_SECONDS', DEFAULT_OUTBOX_INTERVAL_SECONDS, 1),
    },
    addressEncryptionKey,
    places: { serverKey: placesServerKey },
    storage: storageConfig(env),
    logger: env['NODE_ENV'] !== 'test',
  };
}
