import { useRef, useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

import { HomesApiError } from './homes-api';

/** Clave de `homes.errors` con el aviso de un fallo al guardar. */
export type SaveFailure = 'network' | 'conflict' | 'invalid' | 'unknown';

export function saveFailureOf(error: unknown): SaveFailure {
  if (!(error instanceof HomesApiError)) return 'unknown';
  if (error.kind === 'network' || error.kind === 'conflict' || error.kind === 'invalid') {
    return error.kind;
  }
  return 'unknown';
}

/**
 * Guardado de un paso: valida con el resolver del formulario, llama a `save` con los datos ya
 * convertidos y no admite un segundo envío mientras el primero sigue en curso (ni siquiera durante
 * la validación). `handle` recoge los rechazos que se muestran junto a un campo; los demás pasan
 * a `failure`, que se limpia al volver a intentarlo.
 */
export function useStepSubmit<V extends FieldValues, C, O extends FieldValues>(
  form: UseFormReturn<V, C, O>,
  save: (data: O) => Promise<void>,
  handle?: (error: HomesApiError) => boolean,
) {
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<SaveFailure | null>(null);

  const run = form.handleSubmit(async (data) => {
    try {
      await save(data);
    } catch (error) {
      if (error instanceof HomesApiError && handle?.(error)) return;
      setFailure(saveFailureOf(error));
    }
  });

  const submit = () => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setFailure(null);
    run()
      .catch(() => undefined)
      .finally(() => {
        submitting.current = false;
        setSaving(false);
      });
  };

  return { submit, saving, failure };
}
