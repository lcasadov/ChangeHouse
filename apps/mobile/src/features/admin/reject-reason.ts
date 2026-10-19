/** Longitud máxima del motivo de rechazo (`reason` de `adminModerateHome`). */
export const REASON_MAX_LENGTH = 1000;

export type ReasonValidation =
  { ok: true; reason: string } | { ok: false; error: 'required' | 'tooLong' };

/** El motivo de rechazo es obligatorio: de 1 a 1000 caracteres una vez recortados los espacios. */
export function validateReason(text: string): ReasonValidation {
  const reason = text.trim();
  if (reason === '') return { ok: false, error: 'required' };
  if (reason.length > REASON_MAX_LENGTH) return { ok: false, error: 'tooLong' };
  return { ok: true, reason };
}
