import { DomainError } from '../domain-error.js';

/** Tipos de consentimiento; deben coincidir con `ConsentType` de `@changehouse/shared`. */
export const CONSENT_TYPES = [
  'terms',
  'privacy',
  'analytics',
  'marketing',
  'third_party_referral',
] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

/** Aceptación de una versión de un texto o tratamiento; solo se inserta, nunca se modifica (RNF-13). */
export interface Consent {
  readonly type: ConsentType;
  readonly version: string;
  readonly acceptedAt: Date;
}

/** Los textos legales vigentes que el alta exige aceptar. */
export interface LegalVersions {
  readonly terms: string;
  readonly privacy: string;
}

export class LegalAcceptanceRequiredError extends DomainError {
  readonly code = 'LEGAL_ACCEPTANCE_REQUIRED';

  constructor(fields: readonly string[]) {
    super('El alta exige aceptar las versiones vigentes de los términos y de la privacidad');
    this.name = 'LegalAcceptanceRequiredError';
    this.fields = fields;
  }
}

/** Campos del alta que no traen la versión vigente (ausente o distinta), en orden estable. */
export function missingLegalAcceptance(
  accepted: { terms?: string | undefined; privacy?: string | undefined },
  current: LegalVersions,
): string[] {
  const missing: string[] = [];
  if (accepted.terms !== current.terms) missing.push('acceptedTermsVersion');
  if (accepted.privacy !== current.privacy) missing.push('acceptedPrivacyVersion');
  return missing;
}
