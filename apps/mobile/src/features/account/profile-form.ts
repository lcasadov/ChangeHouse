import {
  type ProfileFormData,
  type ProfileFormValues,
  validateProfileForm,
} from '@changehouse/shared';
import type { FieldErrors, Resolver } from 'react-hook-form';

import type { Me } from './account-api';

export type ProfileField = keyof ProfileFormValues;

/** Clave de `profile.errors` con el texto de cada fallo de campo. */
export type ProfileErrorKey =
  'displayNameRequired' | 'displayNameTooLong' | 'municipalityTooLong' | 'phoneInvalid';

/** Valores iniciales del formulario a partir del perfil guardado (lo ausente es una cadena vacía). */
export function formValuesOf(me: Me): ProfileFormValues {
  return {
    displayName: me.displayName,
    municipality: me.municipality ?? '',
    phone: me.phone ?? '',
    meetsVppRequirements: me.meetsVppRequirements,
    isOver65: me.isOver65,
  };
}

/**
 * Valida con el esquema compartido con la API y traduce sus fallos al formato de React Hook Form;
 * el `type` de cada error es el código del esquema (`required`, `too_long`, `invalid`).
 */
export const profileResolver: Resolver<ProfileFormValues, unknown, ProfileFormData> = (values) => {
  const result = validateProfileForm(values);
  if (result.success) return { values: result.data, errors: {} };

  const errors: FieldErrors<ProfileFormValues> = {};
  for (const { field, code } of result.errors) {
    errors[field as ProfileField] = { type: code };
  }
  return { values: {}, errors };
};

/** Texto que corresponde al fallo de un campo; las casillas no pueden fallar. */
export function errorKeyOf(field: ProfileField, type: string): ProfileErrorKey | null {
  if (field === 'displayName') {
    return type === 'too_long' ? 'displayNameTooLong' : 'displayNameRequired';
  }
  if (field === 'municipality') return 'municipalityTooLong';
  if (field === 'phone') return 'phoneInvalid';
  return null;
}
