import type { HomeInput, HomePatch } from '@changehouse/shared';

import type { components } from '../../api/schema';

/** Ficha completa de una vivienda propia (`Home` del contrato). */
export type Home = components['schemas']['Home'];

export type HomesApiErrorKind =
  /** Sin respuesta del servidor: red caída o tiempo agotado. */
  | 'network'
  /** El token no vale (401). */
  | 'unauthorized'
  /** La vivienda no existe o no es de esta persona (404). */
  | 'not-found'
  /** La vivienda ya no admite el cambio: en operación, cerrada o ya enviada (409). */
  | 'conflict'
  /** El servidor rechaza los datos (400). */
  | 'invalid'
  /** El servicio de direcciones no pudo resolver la elegida (422 `ADDRESS_NOT_RESOLVED`). */
  | 'address-not-resolved'
  /** Mínimo mayor que el máximo, o no positivo (422 `INVALID_VALUE_RANGE`). */
  | 'invalid-value-range'
  /** Faltan datos obligatorios para enviar (422 `HOME_INCOMPLETE`); `fields` los nombra. */
  | 'incomplete'
  | 'server';

export class HomesApiError extends Error {
  constructor(
    readonly kind: HomesApiErrorKind,
    /** Campos señalados por la API (`errors[].field`), con los nombres de `HomeInput`. */
    readonly fields: readonly string[] = [],
  ) {
    super(kind);
    this.name = 'HomesApiError';
  }
}

/** Puerto de salida de las viviendas; el adaptador HTTP vive en `http-homes-api.ts`. */
export interface HomesApi {
  /** Las viviendas de la persona en cualquier estado (`listMyHomes`). */
  listMine: () => Promise<Home[]>;
  /** La ficha completa de una vivienda propia (`getHome`). */
  get: (homeId: string) => Promise<Home>;
  /** Crea el borrador con el tipo y la dirección (`createHome`). */
  create: (input: HomeInput) => Promise<Home>;
  /** Guarda un paso del asistente (`updateHome`). */
  update: (homeId: string, patch: HomePatch) => Promise<Home>;
  /** Envía el borrador a revisión (`submitHome`). */
  submit: (homeId: string) => Promise<Home>;
}
