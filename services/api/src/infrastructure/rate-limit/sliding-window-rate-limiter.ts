import type {
  RateLimitDecision,
  UploadRateLimiter,
} from '../../application/chat/upload-rate-limiter.js';

const MS_PER_SECOND = 1000;
/** Cada cuánto se recorren todas las claves para soltar las que ya no tienen peticiones vigentes. */
const SWEEP_INTERVAL_MS = 60_000;

export interface SlidingWindowOptions {
  /** Peticiones admitidas por clave dentro de la ventana. */
  limit: number;
  windowMs: number;
}

/**
 * Límite de ventana deslizante en memoria del proceso, como los demás limitadores de la API: cada
 * instancia cuenta por su cuenta (el límite compartido entre instancias queda fuera de este change).
 * Una petición rechazada no consume cupo.
 */
export class SlidingWindowRateLimiter implements UploadRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private lastSweep = Number.NEGATIVE_INFINITY;

  constructor(private readonly options: SlidingWindowOptions) {}

  hit(key: string, at: Date): RateLimitDecision {
    const now = at.getTime();
    this.sweep(now);
    const recent = (this.hits.get(key) ?? []).filter((time) => time > now - this.options.windowMs);
    const oldest = recent[0];
    if (recent.length >= this.options.limit && oldest !== undefined) {
      const waitMs = oldest + this.options.windowMs - now;
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(waitMs / MS_PER_SECOND)) };
    }
    this.hits.set(key, [...recent, now]);
    return { allowed: true };
  }

  /** Claves con peticiones dentro de la ventana (para comprobar que la memoria no crece sin fin). */
  trackedKeys(): number {
    return this.hits.size;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    const threshold = now - this.options.windowMs;
    for (const [key, times] of this.hits) {
      const alive = times.filter((time) => time > threshold);
      if (alive.length === 0) this.hits.delete(key);
      else if (alive.length !== times.length) this.hits.set(key, alive);
    }
  }
}
