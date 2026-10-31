/** Cómo contactar a una cuenta por correo, según su proveedor de identidad. */
export interface UserContact {
  /** `null` si la cuenta no tiene email. */
  readonly email: string | null;
  readonly emailVerified: boolean;
}

/** Puerto de salida: datos de contacto de una cuenta (Firebase Auth), consultados al despachar. */
export interface UserContactDirectory {
  /** `null` si la cuenta ya no existe; cualquier otro fallo se propaga para reintentar. */
  findContact(firebaseUid: string): Promise<UserContact | null>;
}
