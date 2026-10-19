import type { components } from '../../api/schema';

/** Tarjeta de descubrimiento: la vivienda en su forma pública más la compensación (`DiscoveryCard`). */
export type DiscoveryCard = components['schemas']['DiscoveryCard'];

/** Forma pública de una vivienda ajena (`HomePublic`): sin dirección postal ni datos del propietario. */
export type PublicHome = components['schemas']['HomePublic'];

/** Compensación estimada de quien mira; `null` en modo `seeker` (`DiscoveryCard.compensation`). */
export type Compensation = NonNullable<DiscoveryCard['compensation']>;

export type CompensationKind = Compensation['kind'];

export interface DiscoveryPage {
  items: DiscoveryCard[];
  /** El cursor de la página siguiente, o `null` si no quedan más. */
  nextCursor: string | null;
}

export type DiscoveryApiErrorKind =
  /** Sin respuesta del servidor: red caída o tiempo agotado. */
  | 'network'
  /** El token no vale (401). */
  | 'unauthorized'
  /** Un propietario con varias viviendas publicadas no indicó desde cuál busca (400 `HOME_ID_REQUIRED`). */
  | 'home-required'
  /** La vivienda desde la que se busca no existe, no es suya o ya no está publicada (404). */
  | 'not-found'
  /** Aún no hay preferencias de búsqueda (422 `SEARCH_PREFERENCES_REQUIRED`). */
  | 'preferences-required'
  /** El servidor rechaza la petición (400): cursor o límite no válidos. */
  | 'invalid'
  | 'server';

export class DiscoveryApiError extends Error {
  constructor(readonly kind: DiscoveryApiErrorKind) {
    super(kind);
    this.name = 'DiscoveryApiError';
  }
}

export interface DiscoveryQuery {
  /** Vivienda propia y publicada desde la que se busca; se omite en modo `seeker` o con una sola. */
  homeId?: string;
  /** El `nextCursor` de la página anterior. */
  cursor?: string;
}

/** Puerto de salida del descubrimiento; el adaptador HTTP vive en `http-discovery-api.ts`. */
export interface DiscoveryApi {
  /** Una página de tarjetas compatibles (`discoverHomes`). */
  list: (query: DiscoveryQuery) => Promise<DiscoveryPage>;
  /** La forma pública de una vivienda ajena publicada (`getHome`). */
  getPublicHome: (homeId: string) => Promise<PublicHome>;
}
