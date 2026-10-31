/** Longitud máxima de la nota de resolución (`resolution` de `adminResolveReport`). */
export const NOTE_MAX_LENGTH = 2000;

export type NoteValidation =
  { ok: true; note: string } | { ok: false; error: 'required' | 'tooLong' };

/** La nota de resolución es obligatoria en la app: de 1 a 2000 caracteres recortados los espacios. */
export function validateNote(text: string): NoteValidation {
  const note = text.trim();
  if (note === '') return { ok: false, error: 'required' };
  if (note.length > NOTE_MAX_LENGTH) return { ok: false, error: 'tooLong' };
  return { ok: true, note };
}
