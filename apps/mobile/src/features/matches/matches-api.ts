import type { components } from '../../api/schema';

/** Un match con la forma de la lista (`Match`): participantes con su vivienda y su compensación. */
export type Match = components['schemas']['Match'];

export type MatchParticipant = components['schemas']['MatchParticipant'];

export interface MatchPage {
  items: Match[];
  /** El cursor de la página siguiente, o `null` si no quedan más. */
  nextCursor: string | null;
}

export type MatchesApiErrorKind =
  /** Sin respuesta del servidor: red caída o tiempo agotado. */
  | 'network'
  /** El token no vale (401). */
  | 'unauthorized'
  /** El rol de la cuenta no permite ver matches (403). */
  | 'forbidden'
  /** El servidor rechaza la petición (400): cursor o límite no válidos. */
  | 'invalid'
  | 'server';

export class MatchesApiError extends Error {
  constructor(readonly kind: MatchesApiErrorKind) {
    super(kind);
    this.name = 'MatchesApiError';
  }
}

export interface MatchesQuery {
  /** El `nextCursor` de la página anterior. */
  cursor?: string;
}

/** Puerto de salida de los matches; el adaptador HTTP vive en `http-matches-api.ts`. */
export interface MatchesApi {
  /** Una página de los matches del usuario, del más reciente al más antiguo (`listMyMatches`). */
  list: (query: MatchesQuery) => Promise<MatchPage>;
}
