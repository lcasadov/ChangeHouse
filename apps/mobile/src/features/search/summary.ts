import type { TFunction } from 'i18next';

import { formatEuros } from '../homes/home-form';
import type { Preferences } from './preferences';

/** Las zonas de una búsqueda en una frase: municipios y, si hay, el punto con su radio. */
export function zonesText(t: TFunction, preferences: Preferences): string {
  const parts = [...(preferences.municipalities ?? [])];
  if (preferences.center && preferences.radiusKm) {
    parts.push(t('search.zone.point', { km: preferences.radiusKm }));
  }
  return parts.length > 0 ? parts.join(', ') : t('search.summary.none');
}

/** Resumen de una búsqueda guardada: dónde, cuánto puede pagar y cuánto quiere recibir. */
export function summaryText(t: TFunction, preferences: Preferences): string {
  return t('search.summary.description', {
    zones: zonesText(t, preferences),
    maxToPay: formatEuros(preferences.maxToPayCents),
    minToReceive: formatEuros(preferences.minToReceiveCents),
  });
}
