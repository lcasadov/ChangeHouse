/** Longitud máxima del motivo de una denuncia (`reason` de `createReport`). */
export const REPORT_REASON_MAX_LENGTH = 1000;

export type ReportReasonValidation =
  { ok: true; reason: string } | { ok: false; error: 'required' | 'tooLong' };

/** El motivo es obligatorio: de 1 a 1000 caracteres una vez recortados los espacios. */
export function validateReportReason(text: string): ReportReasonValidation {
  const reason = text.trim();
  if (reason === '') return { ok: false, error: 'required' };
  if (reason.length > REPORT_REASON_MAX_LENGTH) return { ok: false, error: 'tooLong' };
  return { ok: true, reason };
}
