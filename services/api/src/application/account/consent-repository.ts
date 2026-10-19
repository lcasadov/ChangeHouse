import type { Consent } from '../../domain/account/consent.js';

/** Puerto de salida de los consentimientos: solo inserción. */
export interface ConsentRepository {
  /** Del más antiguo al más reciente. */
  listByUser(userId: string): Promise<Consent[]>;
  /**
   * Registra la aceptación. Es idempotente por (tipo, versión): si ya estaba, no cambia nada y
   * devuelve el consentimiento original.
   */
  add(userId: string, consent: Consent): Promise<Consent>;
}
