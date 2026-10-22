/** Variables `EXPO_PUBLIC_*` que lee la autenticación; todas opcionales a nivel de tipo. */
export interface FirebaseEnv {
  EXPO_PUBLIC_FIREBASE_API_KEY?: string | undefined;
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?: string | undefined;
  EXPO_PUBLIC_FIREBASE_PROJECT_ID?: string | undefined;
  EXPO_PUBLIC_FIREBASE_APP_ID?: string | undefined;
  /** `host:puerto` del emulador de Auth (`pnpm emulators`). Solo en desarrollo. */
  EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST?: string | undefined;
}

export interface FirebaseConfig {
  firebase: { apiKey: string; authDomain?: string; projectId: string; appId?: string };
  emulatorHost: string | undefined;
}

/** Proyecto de demostración del emulador: no necesita credenciales reales. */
const LOCAL_PROJECT_ID = 'demo-changehouse';
/** El emulador no valida la clave, pero el SDK exige que haya una. */
const EMULATOR_API_KEY = 'demo-api-key';

const present = (value: string | undefined) => (value ? value : undefined);

/** Lee y valida la configuración; falla al arrancar si falta la clave y no hay emulador. */
export function readFirebaseConfig(env: Readonly<FirebaseEnv>): FirebaseConfig {
  const emulatorHost = present(env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST);
  const apiKey =
    present(env.EXPO_PUBLIC_FIREBASE_API_KEY) ?? (emulatorHost ? EMULATOR_API_KEY : undefined);
  if (!apiKey) {
    throw new Error(
      'Falta EXPO_PUBLIC_FIREBASE_API_KEY: copia apps/mobile/.env.example a .env y rellénala',
    );
  }
  const authDomain = present(env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN);
  const appId = present(env.EXPO_PUBLIC_FIREBASE_APP_ID);

  return {
    firebase: {
      apiKey,
      ...(authDomain ? { authDomain } : {}),
      projectId: present(env.EXPO_PUBLIC_FIREBASE_PROJECT_ID) ?? LOCAL_PROJECT_ID,
      ...(appId ? { appId } : {}),
    },
    emulatorHost,
  };
}
