import type { z } from 'zod';

/** Causa de un campo erróneo; cada cliente la traduce a su texto. */
export type FieldErrorCode = 'required' | 'invalid' | 'too_long';

export interface FieldError {
  field: string;
  code: FieldErrorCode;
}

export type Validation<T> = { success: true; data: T } | { success: false; errors: FieldError[] };

const BODY_FIELD = 'body';

function codeOf(issue: z.core.$ZodIssue): FieldErrorCode {
  if (issue.code === 'too_small') return 'required';
  if (issue.code === 'too_big') return 'too_long';
  return 'invalid';
}

/** Un campo por clave desconocida: así la respuesta señala qué sobra y no solo «cuerpo no válido». */
function fieldsOf(issue: z.core.$ZodIssue): string[] {
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key) => [...issue.path, key].map(String).join('.'));
  }
  return [issue.path.length > 0 ? issue.path.map(String).join('.') : BODY_FIELD];
}

/** Valida contra un esquema y devuelve, como mucho, un error por campo (el primero que se incumple). */
export function validateWith<S extends z.ZodType>(
  schema: S,
  input: unknown,
): Validation<z.output<S>> {
  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: result.data };

  const byField = new Map<string, FieldError>();
  for (const issue of result.error.issues) {
    for (const field of fieldsOf(issue)) {
      if (!byField.has(field)) byField.set(field, { field, code: codeOf(issue) });
    }
  }
  return { success: false, errors: [...byField.values()] };
}
