import { z } from 'zod';

import { validateWith } from './validation.js';

const MAX_DISPLAY_NAME = 60;
const MAX_MUNICIPALITY = 120;
const MAX_CONSENT_VERSION = 40;
const E164 = /^\+[1-9][0-9]{6,14}$/;

/** Tipos de consentimiento (lista cerrada de `ConsentType` en `docs/api/openapi.yaml`). */
export const CONSENT_TYPES = [
  'terms',
  'privacy',
  'analytics',
  'marketing',
  'third_party_referral',
] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

/** `MeInput` (`docs/api/openapi.yaml`): cerrado, de modo que un campo de rol o de estado da 400 (RC-17). */
export const meInputSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(MAX_DISPLAY_NAME),
  municipality: z.string().trim().max(MAX_MUNICIPALITY).optional(),
  phone: z.string().regex(E164).optional(),
  meetsVppRequirements: z.boolean().optional(),
  isOver65: z.boolean().optional(),
  acceptedTermsVersion: z.string().optional(),
  acceptedPrivacyVersion: z.string().optional(),
});

export type MeInput = z.infer<typeof meInputSchema>;

/** `ConsentInput` (`docs/api/openapi.yaml`). */
export const consentInputSchema = z.strictObject({
  type: z.enum(CONSENT_TYPES),
  version: z.string().min(1).max(MAX_CONSENT_VERSION),
});

export type ConsentInput = z.infer<typeof consentInputSchema>;

export const validateMeInput = (input: unknown) => validateWith(meInputSchema, input);

export const validateConsentInput = (input: unknown) => validateWith(consentInputSchema, input);
