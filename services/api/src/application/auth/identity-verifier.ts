/** Identidad que Firebase ha verificado en un ID token. */
export interface VerifiedIdentity {
  readonly uid: string;
  readonly email: string | undefined;
  readonly emailVerified: boolean;
}

/** El token falta, está mal formado, ha caducado o no es auténtico. No lleva el motivo ni el token. */
export class InvalidTokenError extends Error {
  constructor() {
    super('Token no válido');
    this.name = 'InvalidTokenError';
  }
}

/** Puerto de salida: comprueba un ID token de Firebase. */
export interface IdentityVerifier {
  /**
   * @throws InvalidTokenError si el token no es válido; cualquier otro error es un fallo técnico.
   */
  verify(token: string): Promise<VerifiedIdentity>;
}
