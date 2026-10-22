import { useMemo } from 'react';

import { useSocialSignIns } from '../auth/use-social-sign-ins';
import { type AppEnv, createAppServices } from './app-services';
import { SessionRoot } from './SessionRoot';

// Expo sustituye cada `process.env.EXPO_PUBLIC_*` al empaquetar solo si se escribe tal cual, sin dinámicos
const env: AppEnv = {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL as string | undefined,
  EXPO_PUBLIC_LEGAL_BASE_URL: process.env.EXPO_PUBLIC_LEGAL_BASE_URL as string | undefined,
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY as string | undefined,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN as
    string | undefined,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID as
    string | undefined,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID as string | undefined,
  EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST as
    string | undefined,
  EXPO_PUBLIC_GOOGLE_PLACES_KEY: process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY as string | undefined,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID as
    string | undefined,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID as
    string | undefined,
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID as
    string | undefined,
};

/** La sesión de la app con Firebase, la API real y los proveedores externos de este dispositivo. */
export function AppSessionRoot() {
  const social = useSocialSignIns(env);
  const services = useMemo(() => createAppServices(env, social), [social]);
  return <SessionRoot services={services} />;
}
