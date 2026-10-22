import type { Home } from '../../domain/home/home.js';

/** Puerto de salida: almacén de viviendas. */
export interface HomeRepository {
  insert(home: Home): Promise<void>;
  /** Sustituye los datos modificables de una vivienda existente. */
  save(home: Home): Promise<void>;
  findById(id: string): Promise<Home | null>;
  /** Las viviendas del propietario en cualquier estado, de la más antigua a la más reciente. */
  listByOwner(ownerId: string): Promise<Home[]>;
}
