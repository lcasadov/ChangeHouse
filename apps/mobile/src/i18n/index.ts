import { getLocales } from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import esES from './locales/es-ES.json';

export const DEFAULT_LANGUAGE = 'es-ES';
export const SUPPORTED_LANGUAGES = [DEFAULT_LANGUAGE] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const resources = { 'es-ES': { translation: esES } } as const;

interface DeviceLocale {
  languageTag: string;
  languageCode: string | null;
}

/**
 * Idioma de la app a partir de las preferencias del dispositivo: coincidencia exacta con
 * la etiqueta o, si no, por código de idioma (`es-MX` → `es-ES`). Sin coincidencia, el predeterminado.
 */
export function resolveLanguage(locales: readonly DeviceLocale[]): SupportedLanguage {
  for (const locale of locales) {
    const supported = SUPPORTED_LANGUAGES.find(
      (language) =>
        language === locale.languageTag ||
        (locale.languageCode !== null && language.startsWith(`${locale.languageCode}-`)),
    );
    if (supported) return supported;
  }
  return DEFAULT_LANGUAGE;
}

/** Inicializa i18next de forma síncrona (los recursos van empaquetados). */
export function initI18n(locales: readonly DeviceLocale[] = getLocales()) {
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      resources,
      lng: resolveLanguage(locales),
      fallbackLng: DEFAULT_LANGUAGE,
      initAsync: false,
      interpolation: { escapeValue: false },
    });
  }
  return i18next;
}

export default initI18n();
