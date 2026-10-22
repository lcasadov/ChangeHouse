import type { Home } from '../homes/homes-api';

export type AdminApiErrorKind =
  /** Sin respuesta del servidor: red caída o tiempo agotado. */
  | 'network'
  /** El token no vale (401). */
  | 'unauthorized'
  /** La persona no tiene el rol `admin` (403). */
  | 'forbidden'
  /** La vivienda no existe (404). */
  | 'not-found'
  /** La vivienda no está en revisión: otra persona ya la moderó (409). */
  | 'conflict'
  /** El servidor rechaza la decisión, p. ej. un rechazo sin motivo (400). */
  | 'invalid'
  | 'server';

export class AdminApiError extends Error {
  constructor(readonly kind: AdminApiErrorKind) {
    super(kind);
    this.name = 'AdminApiError';
  }
}

/** Una página de la cola de moderación (`adminListHomes`). */
export interface ModerationPage {
  items: Home[];
  /** Cursor opaco de la página siguiente, o `null` si no hay más. */
  nextCursor: string | null;
}

/** La decisión sobre una vivienda en revisión (`adminModerateHome`); rechazar exige motivo. */
export type ModerationDecision = { decision: 'approve' } | { decision: 'reject'; reason: string };

/** Puerto de salida de la administración; el adaptador HTTP vive en `http-admin-api.ts`. */
export interface AdminApi {
  /** La cola: viviendas en revisión de la enviada antes a la enviada después. */
  listPending: (cursor?: string) => Promise<ModerationPage>;
  /** Aprueba o rechaza una vivienda en revisión y devuelve su ficha ya actualizada. */
  moderate: (homeId: string, decision: ModerationDecision) => Promise<Home>;
}
