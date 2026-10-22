import type { components } from '../../api/schema';

/** Un match con la forma de la lista (`Match`): participantes con su vivienda y su compensación. */
export type Match = components['schemas']['Match'];

/** El detalle de un match (`MatchDetail`): lo de la lista más las viviendas, direcciones y teléfonos autorizados. */
export type MatchDetail = components['schemas']['MatchDetail'];

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
  /** El match no existe o la persona no participa en él (404). */
  | 'not-found'
  /** El match ya no admite la acción: está cerrado o caducado (409 `MATCH_NOT_OPEN`). */
  | 'not-open'
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
  /** El detalle de un match del que participa el usuario (`getMatch`). */
  get: (matchId: string) => Promise<MatchDetail>;
  /** Confirma el interés del usuario; idempotente (`confirmMatch`). */
  confirm: (matchId: string) => Promise<Match>;
  /** Se retira y cierra el match para todos (`withdrawFromMatch`). */
  withdraw: (matchId: string) => Promise<Match>;
  /** Autoriza o revoca mostrar su teléfono a los demás participantes (`setPhoneSharing`). */
  setPhoneSharing: (matchId: string, share: boolean) => Promise<void>;
}
