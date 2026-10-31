/** Puerto de salida: da de baja la cuenta en el proveedor de identidad (Firebase Authentication). */
export interface IdentityRemover {
  /** Elimina la cuenta; que ya no exista cuenta con ese uid cuenta como hecho, no como error. */
  remove(uid: string): Promise<void>;
}
