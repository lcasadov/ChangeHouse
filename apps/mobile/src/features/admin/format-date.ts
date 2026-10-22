import i18next from 'i18next';

import { DEFAULT_LANGUAGE } from '../../i18n';

/** Una fecha ISO en el idioma de la app, p. ej. «10 oct 2026». */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(i18next.language || DEFAULT_LANGUAGE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}
