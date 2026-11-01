import type { PurgeSummary } from './retention-purge.js';

/**
 * Programa la purga de retención dentro de la propia API, como el despachador del outbox: una
 * ejecución al arrancar y otra cada intervalo. La exclusión entre instancias la da el bloqueo
 * consultivo de la purga; aquí solo se evita solapar ejecuciones de la misma instancia.
 */
export class RetentionSchedule {
  private timer: NodeJS.Timeout | null = null;
  private inflight: Promise<void> | null = null;

  constructor(
    private readonly purge: () => Promise<PurgeSummary>,
    private readonly intervalMs: number,
    private readonly onError: (error: unknown) => void,
  ) {}

  /** Ejecuta ahora y repite cada intervalo hasta `stop`. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.kick();
    }, this.intervalMs);
    this.timer.unref();
    this.kick();
  }

  /** Detiene el temporizador y espera a la ejecución en curso, si la hay. */
  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.inflight;
  }

  /** Ejecuta una purga ya y devuelve su resumen (lo usan las pruebas y las operaciones manuales). */
  run(): Promise<PurgeSummary> {
    return this.purge();
  }

  private kick(): void {
    if (this.inflight) return;
    this.inflight = this.purge()
      .then(() => undefined)
      .catch((error: unknown) => {
        this.onError(error);
      })
      .finally(() => {
        this.inflight = null;
      });
  }
}
