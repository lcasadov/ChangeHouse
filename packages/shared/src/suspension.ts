import { z } from 'zod';

import { validateWith } from './validation.js';

/** Longitud máxima del motivo (`adminSetUserSuspension` en `docs/api/openapi.yaml`). */
export const MAX_SUSPENSION_REASON = 1000;

/** Cuerpo de `adminSetUserSuspension`: suspender o reactivar, siempre con motivo. */
export const suspensionInputSchema = z.strictObject({
  suspended: z.boolean(),
  reason: z.string().trim().min(1).max(MAX_SUSPENSION_REASON),
});
export type SuspensionInput = z.output<typeof suspensionInputSchema>;

export const validateSuspensionInput = (input: unknown) =>
  validateWith(suspensionInputSchema, input);
