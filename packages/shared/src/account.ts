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

const displayNameSchema = z.string().trim().min(1).max(MAX_DISPLAY_NAME);
const municipalitySchema = z.string().trim().max(MAX_MUNICIPALITY);
const phoneSchema = z.string().regex(E164);

/**
 * Datos de perfil que el usuario edita (`MeInput` sin los textos legales). Cerrado, de modo que un campo de
 * rol o de estado da 400 (RC-17). Lo comparten la API y el formulario del perfil.
 */
export const profileSchema = z.strictObject({
  displayName: displayNameSchema,
  municipality: municipalitySchema.optional(),
  // `null` borra el teléfono; omitirlo no lo toca
  phone: phoneSchema.nullable().optional(),
  meetsVppRequirements: z.boolean().optional(),
  isOver65: z.boolean().optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

/** `MeInput` (`docs/api/openapi.yaml`): el perfil más las versiones legales del primer acceso. */
export const meInputSchema = profileSchema.extend({
  acceptedTermsVersion: z.string().optional(),
  acceptedPrivacyVersion: z.string().optional(),
});

export type MeInput = z.infer<typeof meInputSchema>;

/** Espacios y guiones al escribir un teléfono no lo hacen distinto: se quitan antes de validar. */
const PHONE_SEPARATORS = /[\s-]/g;

/**
 * Lo que escribe la persona en el formulario del perfil: cada texto llega como cadena (vacía si no
 * lo rellena) y se valida con las mismas reglas que la API. Un teléfono vacío es `null`, que borra el teléfono guardado.
 */
export const profileFormSchema = z.object({
  displayName: displayNameSchema,
  municipality: municipalitySchema,
  phone: z
    .string()
    .transform((value) => value.replace(PHONE_SEPARATORS, ''))
    .pipe(z.union([z.literal('').transform(() => null), phoneSchema])),
  meetsVppRequirements: z.boolean(),
  isOver65: z.boolean(),
});

export type ProfileFormValues = z.input<typeof profileFormSchema>;
export type ProfileFormData = z.output<typeof profileFormSchema>;

/** `ConsentInput` (`docs/api/openapi.yaml`). */
export const consentInputSchema = z.strictObject({
  type: z.enum(CONSENT_TYPES),
  version: z.string().min(1).max(MAX_CONSENT_VERSION),
});

export type ConsentInput = z.infer<typeof consentInputSchema>;

export const validateProfileForm = (input: unknown) => validateWith(profileFormSchema, input);

export const validateMeInput = (input: unknown) => validateWith(meInputSchema, input);

export const validateConsentInput = (input: unknown) => validateWith(consentInputSchema, input);
