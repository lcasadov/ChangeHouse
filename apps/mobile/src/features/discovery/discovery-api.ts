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

/** Resultado de un me gusta (`LikeResult`): `match` llega con `add-direct-match`; hoy es siempre nulo. */
export type LikeResult = components['schemas']['LikeResult'];

export type DecisionApiErrorKind =
  /** Sin respuesta del servidor: red caída o tiempo agotado. */
  | 'network'
  /** El token no vale (401). */
  | 'unauthorized'
  /** El usuario no puede dar me gusta: sin vivienda publicada, agencia o administración (403). */
  | 'forbidden'
  /** La vivienda de origen o la de destino ya no existe, no es la que era o no está publicada (404). */
  | 'not-found'
  /** La vivienda propia desde la que se decide ya no está publicada (409 `HOME_NOT_PUBLISHED`). */
  | 'home-not-published'
  /** Ya existía ese me gusta (409 `LIKE_EXISTS`). */
  | 'already-liked'
  /** Se superó el límite diario de me gusta (429 `DAILY_LIKE_LIMIT`). */
  | 'daily-limit'
  /** El me gusta ya forma un match y no se deshace (409 `LIKE_IN_MATCH`). */
  | 'like-in-match'
  /** El servidor rechaza la petición (400). */
  | 'invalid'
  | 'server';

export class DecisionApiError extends Error {
  constructor(
    readonly kind: DecisionApiErrorKind,
    /** Solo en `daily-limit`: segundos hasta que vuelve el cupo (`Retry-After`), si la cabecera era válida. */
    readonly retryAfterSeconds?: number,
  ) {
    super(kind);
    this.name = 'DecisionApiError';
  }
}

export interface LikeInput {
  /** La vivienda propia y publicada que ofrece el usuario. */
  fromHomeId: string;
  targetHomeId: string;
}

export interface DismissInput {
  /** La vivienda propia desde la que se descarta; se omite para un buscador sin vivienda. */
  fromHomeId?: string;
  targetHomeId: string;
}

export interface UndoInput {
  /** La vivienda propia cuya última acción se deshace; se omite para un buscador sin vivienda. */
  homeId?: string;
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
  /** Me gusta desde una vivienda propia (`likeHome`). */
  like: (input: LikeInput) => Promise<LikeResult>;
  /** Descarta una vivienda (`dismissHome`); idempotente. */
  dismiss: (input: DismissInput) => Promise<void>;
  /** Deshace el último me gusta o descarte (`undoLastAction`). */
  undo: (input: UndoInput) => Promise<void>;
}
