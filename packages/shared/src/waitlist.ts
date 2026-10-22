import { z } from 'zod';

import { HOME_TYPES } from './home-type.js';

const MAX_EMAIL = 254;
const MAX_MUNICIPALITY = 120;
const MAX_LOOKING_FOR = 500;

/** Esquema de `WaitlistInput` (`docs/api/openapi.yaml`); lo usan la landing y la API. */
export const waitlistInputSchema = z.object({
  email: z.string().trim().min(1).max(MAX_EMAIL).pipe(z.email()),
  municipality: z.string().trim().min(1).max(MAX_MUNICIPALITY),
  homeType: z.enum(HOME_TYPES),
  lookingFor: z.string().trim().min(1).max(MAX_LOOKING_FOR),
  consent: z.literal(true),
});

export type WaitlistInput = z.infer<typeof waitlistInputSchema>;

/** Causa de un campo erróneo; cada cliente la traduce a su texto. */
export type FieldErrorCode = 'required' | 'invalid' | 'too_long';

export interface FieldError {
  field: string;
  code: FieldErrorCode;
}

export type WaitlistValidation =
  { success: true; data: WaitlistInput } | { success: false; errors: FieldError[] };

const BODY_FIELD = 'body';

function codeOf(issue: z.core.$ZodIssue): FieldErrorCode {
  if (issue.code === 'too_small') return 'required';
  if (issue.code === 'too_big') return 'too_long';
  return 'invalid';
}

/** Valida una alta y devuelve, como mucho, un error por campo (el primero que se incumple). */
export function validateWaitlistInput(input: unknown): WaitlistValidation {
  const result = waitlistInputSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };

  const byField = new Map<string, FieldError>();
  for (const issue of result.error.issues) {
    const field = issue.path.length > 0 ? issue.path.map(String).join('.') : BODY_FIELD;
    if (!byField.has(field)) byField.set(field, { field, code: codeOf(issue) });
  }
  return { success: false, errors: [...byField.values()] };
}
