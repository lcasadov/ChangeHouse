/** Resultado de contar una petición contra el límite. */
export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Puerto de salida: límite de peticiones por clave en una ventana de tiempo. `hit` cuenta la
 * petición si cabe; si no cabe, no consume cupo e indica cuánto esperar.
 */
export interface UploadRateLimiter {
  hit(key: string, at: Date): RateLimitDecision;
}
