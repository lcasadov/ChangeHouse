import { z } from 'zod';

import { validateWith } from './validation.js';

/** Longitud máxima del motivo de un rechazo (`adminModerateHome` en `docs/api/openapi.yaml`). */
export const MAX_MODERATION_REASON = 1000;

const approve = z.strictObject({
  decision: z.literal('approve'),
  // El contrato lo admite siempre pero solo importa al rechazar: aquí se descarta
  reason: z
    .string()
    .max(MAX_MODERATION_REASON)
    .optional()
    .transform(() => undefined),
});

const reject = z.strictObject({
  decision: z.literal('reject'),
  reason: z.string().trim().min(1).max(MAX_MODERATION_REASON),
});

/** Cuerpo de `adminModerateHome`: el motivo es obligatorio solo al rechazar. */
export const moderationInputSchema = z
  .discriminatedUnion('decision', [approve, reject])
  .transform((input) =>
    input.decision === 'approve'
      ? ({ decision: 'approve' } as const)
      : ({ decision: 'reject', reason: input.reason } as const),
  );
export type ModerationInput = z.output<typeof moderationInputSchema>;

export const validateModerationInput = (input: unknown) =>
  validateWith(moderationInputSchema, input);
