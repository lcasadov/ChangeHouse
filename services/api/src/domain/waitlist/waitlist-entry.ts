import { DomainError } from '../domain-error.js';

/** Tipos de vivienda admitidos; deben coincidir con `HomeType` de `@changehouse/shared`. */
export type HomeType =
  'piso' | 'atico' | 'duplex' | 'estudio' | 'bajo' | 'chalet' | 'adosado' | 'pareado' | 'casa';

export interface WaitlistEntry {
  readonly id: string;
  readonly email: string;
  readonly municipality: string;
  readonly homeType: HomeType;
  readonly lookingFor: string;
  readonly consentAt: Date;
}

export class ConsentRequiredError extends DomainError {
  readonly code = 'CONSENT_REQUIRED';

  constructor() {
    super('La inscripción exige aceptar la política de privacidad');
    this.name = 'ConsentRequiredError';
  }
}

/** Forma canónica del email: dos escrituras del mismo email son la misma inscripción. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface NewWaitlistEntry {
  id: string;
  email: string;
  municipality: string;
  homeType: HomeType;
  lookingFor: string;
  consent: true;
  consentAt: Date;
}

/** Crea la inscripción; sin consentimiento no hay inscripción (base legal del tratamiento). */
export function createWaitlistEntry(data: NewWaitlistEntry): WaitlistEntry {
  // El tipo ya exige `true`, pero el dominio no se fía de quien lo llame
  if (data.consent !== true) throw new ConsentRequiredError();
  return {
    id: data.id,
    email: normalizeEmail(data.email),
    municipality: data.municipality,
    homeType: data.homeType,
    lookingFor: data.lookingFor,
    consentAt: data.consentAt,
  };
}
