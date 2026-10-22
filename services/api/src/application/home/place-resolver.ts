import type { HomeLocation } from '../../domain/home/home.js';

/**
 * Puerto de salida: resuelve en el servidor el lugar que el cliente eligió en el autocompletado.
 * Devuelve `null` si el identificador no corresponde a ninguna dirección que se pueda situar;
 * un fallo técnico del servicio se propaga como excepción.
 */
export interface PlaceResolver {
  resolve(placeId: string): Promise<HomeLocation | null>;
}
