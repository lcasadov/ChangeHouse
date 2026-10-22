import { useState } from 'react';

import type { Preferences } from './preferences';
import {
  buildInput,
  errorsFromApi,
  type FormErrors,
  formFromPreferences,
  type PreferencesForm,
} from './preferences-form';
import { SearchPreferencesApiError } from './search-preferences-api';

export interface PreferencesEditor {
  form: PreferencesForm;
  setForm: (next: PreferencesForm) => void;
  errors: FormErrors;
  saving: boolean;
  /** Valida y guarda; devuelve `true` si se guardó. Los errores quedan en `errors`, junto a su campo. */
  submit: () => Promise<boolean>;
}

/**
 * Estado de un formulario de preferencias: valida con las mismas reglas que el servidor, evita el
 * doble envío y traduce los rechazos de la API (400 por campo, 422 sin zona) a errores de campo.
 */
export function usePreferencesEditor(
  initial: Preferences | null,
  save: (input: Preferences) => Promise<void>,
): PreferencesEditor {
  const [form, setFormState] = useState(() => formFromPreferences(initial));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const submit = async (): Promise<boolean> => {
    if (saving) return false;
    const built = buildInput(form);
    if (!built.ok) {
      setErrors(built.errors);
      return false;
    }
    setErrors({});
    setSaving(true);
    try {
      await save(built.input);
      return true;
    } catch (error) {
      setErrors(
        error instanceof SearchPreferencesApiError ? errorsFromApi(error) : { general: true },
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    form,
    setForm: (next) => {
      setFormState(next);
      setErrors({});
    },
    errors,
    saving,
    submit,
  };
}
