import type { HomePhoto } from '../../domain/home/photo.js';

/** Puerto de salida: almacén de las fotos de las viviendas. */
export interface PhotoRepository {
  insertPending(photo: HomePhoto): Promise<void>;
  /** La foto de esa vivienda, en cualquier estado; `null` si no existe o es de otra vivienda. */
  find(homeId: string, photoId: string): Promise<HomePhoto | null>;
  /** Las fotos `ready` de la vivienda por posición. */
  listReady(homeId: string): Promise<HomePhoto[]>;
  /** Las fotos `ready` de varias viviendas, por vivienda y posición. */
  listReadyByHomes(homeIds: readonly string[]): Promise<HomePhoto[]>;
  countReady(homeId: string): Promise<number>;
  /**
   * Pasa la foto a `ready` en la primera posición libre, de forma atómica frente a otras
   * confirmaciones de la misma vivienda. `null` si la vivienda ya tiene 20 fotos `ready`.
   */
  markReady(homeId: string, photoId: string): Promise<HomePhoto | null>;
  delete(homeId: string, photoId: string): Promise<void>;
}
