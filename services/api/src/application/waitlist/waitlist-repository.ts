import type { WaitlistEntry } from '../../domain/waitlist/waitlist-entry.js';

/** Puerto de salida de la lista de espera. */
export interface WaitlistRepository {
  /**
   * Guarda la inscripción. Es idempotente por email: si ya existe (sin distinguir
   * mayúsculas), no hace nada ni falla.
   */
  add(entry: WaitlistEntry): Promise<void>;
}
