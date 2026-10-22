import { DEFAULT_VALUE_REFERENCE_PCT, validateSearchPreferences } from '@changehouse/shared';

import { decimalFieldText, euroFieldText, parseDecimal, parseEuros } from '../homes/home-form';
import { fromApi, hasZone, type Preferences, withFilters } from './preferences';
import type { SearchPreferences, SearchPreferencesApiError } from './search-preferences-api';

/** Lo que se edita en la hoja, el primer uso y las preferencias de una vivienda. */
export interface PreferencesForm {
  /** Zona, filtros estructurados y punto de referencia: lo que no se escribe a mano. */
  draft: Preferences;
  /** Lo escrito en los campos de euros y de metros, tal cual (se interpreta al guardar). */
  maxToPay: string;
  minToReceive: string;
  minUsefulM2: string;
}

/** Campos que pueden fallar; `general` es un fallo que no se puede atribuir a uno solo. */
export type FormField =
  'zone' | 'radius' | 'maxToPay' | 'minToReceive' | 'valueReferencePct' | 'minUsefulM2' | 'general';

export type FormErrors = Partial<Record<FormField, true>>;

export type BuildResult = { ok: true; input: Preferences } | { ok: false; errors: FormErrors };

const EMPTY: Preferences = {
  municipalities: [],
  filters: {},
  maxToPayCents: 0,
  minToReceiveCents: 0,
  valueReferencePct: DEFAULT_VALUE_REFERENCE_PCT,
};

/** El formulario para unas preferencias guardadas, o vacío (importes sin rellenar) si no las hay. */
export function formFromPreferences(
  saved: Preferences | SearchPreferences | null,
): PreferencesForm {
  if (!saved) return { draft: EMPTY, maxToPay: '', minToReceive: '', minUsefulM2: '' };
  const draft = fromApi(saved);
  return {
    draft,
    maxToPay: euroFieldText(draft.maxToPayCents),
    minToReceive: euroFieldText(draft.minToReceiveCents),
    minUsefulM2: decimalFieldText(draft.filters?.minUsefulM2),
  };
}

const API_FIELDS: Record<string, FormField> = {
  municipalities: 'zone',
  center: 'zone',
  radiusKm: 'radius',
  maxToPayCents: 'maxToPay',
  minToReceiveCents: 'minToReceive',
  valueReferencePct: 'valueReferencePct',
  'filters.minUsefulM2': 'minUsefulM2',
};

const fieldOfApi = (field: string): FormField => API_FIELDS[field] ?? 'general';

/** Un importe en euros a céntimos, o `undefined` si falta o no es un importe. */
function centsOf(text: string): number | undefined {
  const cents = parseEuros(text);
  return cents === undefined || Number.isNaN(cents) ? undefined : cents;
}

/**
 * Valida lo escrito y lo convierte en el documento que se guarda. Los importes se escriben en euros
 * y viajan en céntimos; el resto de la validación es la misma del servidor (`packages/shared`).
 */
export function buildInput(form: PreferencesForm): BuildResult {
  const errors: FormErrors = {};
  if (!hasZone(form.draft)) errors.zone = true;

  const maxToPayCents = centsOf(form.maxToPay);
  const minToReceiveCents = centsOf(form.minToReceive);
  if (maxToPayCents === undefined) errors.maxToPay = true;
  if (minToReceiveCents === undefined) errors.minToReceive = true;

  const usefulM2 = parseDecimal(form.minUsefulM2);
  if (usefulM2 !== undefined && Number.isNaN(usefulM2)) errors.minUsefulM2 = true;

  if (
    Object.keys(errors).length > 0 ||
    maxToPayCents === undefined ||
    minToReceiveCents === undefined
  ) {
    return { ok: false, errors };
  }

  const candidate = withFilters(
    { ...form.draft, maxToPayCents, minToReceiveCents },
    { minUsefulM2: usefulM2 },
  );
  const validation = validateSearchPreferences(candidate);
  if (validation.success) return { ok: true, input: validation.data };
  return {
    ok: false,
    errors: Object.fromEntries(validation.errors.map((e) => [fieldOfApi(e.field), true])),
  };
}

/** Los campos que la API señaló al rechazar el guardado, para mostrar cada error junto a su campo. */
export function errorsFromApi(error: SearchPreferencesApiError): FormErrors {
  const errors: FormErrors = {};
  if (error.kind === 'incomplete') errors.zone = true;
  if (error.kind === 'invalid' || error.kind === 'incomplete') {
    for (const field of error.fields) errors[fieldOfApi(field)] = true;
  }
  return Object.keys(errors).length > 0 ? errors : { general: true };
}
