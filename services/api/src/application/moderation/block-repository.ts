/** Puerto de salida: bloqueos entre usuarios (RF-63). */
export interface BlockRepository {
  /** Registra que `blockerId` bloquea a `blockedId`; si ya lo bloqueaba no hace nada. */
  add(blockerId: string, blockedId: string, at: Date): Promise<void>;
}
