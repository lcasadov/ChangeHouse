import { z } from 'zod';

import { HOME_TYPES } from './home-type.js';
import { validateWith, type Validation } from './validation.js';

const MAX_EMAIL = 254;
const MAX_MUNICIPALITY = 120;
const MAX_LOOKING_FOR = 500;

/** Esquema de `WaitlistInput` (`docs/api/openapi.yaml`); lo usan la landing y la API. */
export const waitlistInputSchema = z.strictObject({
  email: z.string().trim().min(1).max(MAX_EMAIL).pipe(z.email()),
  municipality: z.string().trim().min(1).max(MAX_MUNICIPALITY),
  homeType: z.enum(HOME_TYPES),
  lookingFor: z.string().trim().min(1).max(MAX_LOOKING_FOR),
  consent: z.literal(true),
});

export type WaitlistInput = z.infer<typeof waitlistInputSchema>;

export type WaitlistValidation = Validation<WaitlistInput>;

/** Valida una alta y devuelve, como mucho, un error por campo (el primero que se incumple). */
export const validateWaitlistInput = (input: unknown): WaitlistValidation =>
  validateWith(waitlistInputSchema, input);
