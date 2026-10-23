import type { HomeStatus } from '@changehouse/shared';

import type { Home, RelevantChange } from '../../domain/home/home.js';
import type { ModerationCursor } from '../moderation/cursor.js';

/**
 * Consulta de administración: sin `status`, todas las viviendas de la más reciente a la más antigua
 * por alta; con `in_review`, la cola por fecha de envío ascendente. En ambos casos desempata el id.
 */
export interface ModerationListing {
  status?: HomeStatus;
  /** Continúa tras esta posición (exclusiva). */
  after?: ModerationCursor;
  limit: number;
}

/** Puerto de salida: almacén de viviendas. */
export interface HomeRepository {
  insert(home: Home): Promise<void>;
  /** Sustituye los datos modificables de una vivienda existente. */
  save(home: Home): Promise<void>;
  findById(id: string): Promise<Home | null>;
  /** Como `findById`, pero bloquea la fila hasta el final de la transacción en curso. */
  findByIdForUpdate(id: string): Promise<Home | null>;
  /**
   * Anota un cambio relevante (fotos) sin reescribir el resto de la vivienda, para no pisar una
   * edición concurrente de la ficha: la fecha y, si vuelve a revisión, el estado y la fecha de envío.
   */
  markRelevantChange(id: string, change: RelevantChange): Promise<void>;
  /** Las viviendas del propietario en cualquier estado, de la más antigua a la más reciente. */
  listByOwner(ownerId: string): Promise<Home[]>;
  /** Una página de viviendas para la administración. */
  listForModeration(query: ModerationListing): Promise<Home[]>;
}
