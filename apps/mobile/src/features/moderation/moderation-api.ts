export type ReportTargetType = 'user' | 'home' | 'message';

/** Lo que se denuncia: un usuario, una vivienda o un mensaje de chat, por su identificador. */
export interface ReportTarget {
  type: ReportTargetType;
  id: string;
}

export type ModerationApiErrorKind =
  /** Sin respuesta del servidor: red caída o tiempo agotado. */
  | 'network'
  /** El token no vale (401). */
  | 'unauthorized'
  /** El objetivo ya no existe o no es accesible para esta persona (404). */
  | 'not-found'
  /** El límite de denuncias por hora está superado (429). */
  | 'rate-limited'
  /** El servidor rechaza la petición (400). */
  | 'invalid'
  | 'server';

export class ModerationApiError extends Error {
  constructor(readonly kind: ModerationApiErrorKind) {
    super(kind);
    this.name = 'ModerationApiError';
  }
}

/** Puerto de salida de denuncias y bloqueos; el adaptador HTTP vive en `http-moderation-api.ts`. */
export interface ModerationApi {
  /** Denuncia un usuario, una vivienda o un mensaje (`createReport`). */
  report: (target: ReportTarget, reason: string) => Promise<void>;
  /** Bloquea a un usuario en los dos sentidos (`blockUser`). */
  block: (userId: string) => Promise<void>;
}
