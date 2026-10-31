// Valores compartidos del entorno E2E local: los usan la preparación, la configuración de Playwright y las pruebas.
const { resolve } = process.getBuiltinModule('node:path');

const MOBILE_DIR = resolve(__dirname, '../..');
const ROOT_DIR = resolve(MOBILE_DIR, '../..');
/** Export estático de la app web: dentro de `.expo` (ignorado por git, lint y formato). */
const DIST_DIR = resolve(MOBILE_DIR, '.expo/e2e-dist');

const API_PORT = 8080;
const APP_PORT = 8081;
const PROJECT_ID = 'demo-changehouse';
/** Base de datos propia de las pruebas E2E: se recrea en cada ejecución, no toca la de desarrollo. */
const E2E_DATABASE = 'changehouse_e2e';
const DATABASE_URL = `postgres://changehouse:changehouse@localhost:5432/${E2E_DATABASE}`;

/** Variables que la API necesita; el resto de valores locales son los de `services/api/.env.example`. */
const API_ENV = {
  PORT: String(API_PORT),
  DATABASE_URL,
  FIREBASE_PROJECT_ID: PROJECT_ID,
  FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
  FIRESTORE_EMULATOR_HOST: 'localhost:8085',
  STORAGE_EMULATOR_HOST: 'localhost:4443',
  STORAGE_PRIVATE_BUCKET: 'changehouse-photos-private',
  STORAGE_PUBLIC_BUCKET: 'changehouse-photos-public',
  APP_ORIGIN: `http://localhost:${String(APP_PORT)}`,
  APP_PUBLIC_URL: `http://localhost:${String(APP_PORT)}`,
  ADDRESS_ENCRYPTION_KEY: 'ZGV2LW9ubHktYWRkcmVzcy1rZXktMzItYnl0ZXMhISE=',
  // El chat se crea al despachar el hecho «match creado»: con 1 s no hay que esperar 30
  OUTBOX_INTERVAL_SECONDS: '1',
  // Sin clave de Places, la API y la app usan los lugares de prueba
  GOOGLE_PLACES_SERVER_KEY: '',
  SENTRY_DSN: '',
};

/** Variables que se incrustan en la app web al exportarla. */
const APP_ENV = {
  EXPO_PUBLIC_API_URL: `http://localhost:${String(API_PORT)}/v1`,
  EXPO_PUBLIC_LEGAL_BASE_URL: 'http://localhost:4321',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
  EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST: 'localhost:8085',
  EXPO_PUBLIC_GOOGLE_PLACES_KEY: '',
  EXPO_PUBLIC_SENTRY_DSN: '',
};

module.exports = {
  MOBILE_DIR,
  ROOT_DIR,
  DIST_DIR,
  API_PORT,
  APP_PORT,
  PROJECT_ID,
  E2E_DATABASE,
  DATABASE_URL,
  API_ENV,
  APP_ENV,
};
