import type { Consent } from './consent';

export const ANALYTICS_ALLOWED = 'changehouse:analytics-allowed';
export const ANALYTICS_REVOKED = 'changehouse:analytics-revoked';

/**
 * Punto de enganche de la analítica: no carga nada por sí mismo. Emite un evento cuando la
 * persona acepta y otro cuando revoca, de modo que cualquier herramienta futura solo se
 * inicia (o se detiene) a partir de ellos y nunca antes del consentimiento.
 * Devuelve la función para desactivar el enganche.
 */
export function bindAnalytics(consent: Consent, target: EventTarget): () => void {
  let active = false;

  const apply = () => {
    const accepted = consent.getConsent() === 'accepted';
    if (accepted === active) return;
    active = accepted;
    target.dispatchEvent(new Event(accepted ? ANALYTICS_ALLOWED : ANALYTICS_REVOKED));
  };

  apply();
  return consent.onConsentChange(apply);
}
