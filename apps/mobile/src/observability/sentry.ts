import * as Sentry from '@sentry/react-native';

/**
 * Inicializa Sentry solo si hay DSN (`EXPO_PUBLIC_SENTRY_DSN`); sin él no hace nada.
 * Expo sustituye `process.env.EXPO_PUBLIC_*` al empaquetar, por eso se lee con esa forma literal.
 * No se envían datos personales por defecto (RGPD).
 */
export function initSentry(
  dsn = process.env.EXPO_PUBLIC_SENTRY_DSN as string | undefined,
): boolean {
  if (!dsn) return false;
  Sentry.init({ dsn, sendDefaultPii: false });
  return true;
}
