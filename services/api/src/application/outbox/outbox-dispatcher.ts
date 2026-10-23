import type { Clock } from '../clock.js';
import type { OutboxProcessor, PendingOutboxEvent, ProcessSummary } from './outbox.js';

const BATCH_SIZE = 50;

export interface OutboxDispatcherDeps {
  store: OutboxProcessor;
  /** Un manejador por tipo de hecho, que recibe el identificador del agregado. */
  handlers: Readonly<Record<string, (aggregateId: string) => Promise<void>>>;
  clock: Clock;
  /** Cada cuánto se reintentan los pendientes mientras el despachador está en marcha. */
  intervalMs: number;
  /** Se avisa de cada fallo; el hecho sigue pendiente y se reintenta. */
  onError: (error: unknown, event: PendingOutboxEvent) => void;
}

/**
 * Entrega los hechos de la bandeja de salida a sus manejadores: tras la petición que los generó
 * (`kick`), al arrancar y cada intervalo (`start`). Solo hay una ejecución a la vez; si llega otra
 * petición durante ella, se repite al terminar para no dejar hechos recién llegados esperando.
 */
export class OutboxDispatcher {
  private inflight: Promise<ProcessSummary> | null = null;
  private rerun = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly deps: OutboxDispatcherDeps) {}

  /** Despacha los pendientes y devuelve el resumen; las llamadas simultáneas comparten ejecución. */
  dispatch(): Promise<ProcessSummary> {
    if (this.inflight) {
      this.rerun = true;
      return this.inflight;
    }
    const run = this.runUntilIdle().finally(() => {
      this.inflight = null;
    });
    this.inflight = run;
    return run;
  }

  /** Despacha sin esperar y sin lanzar nunca: lo usa la petición HTTP que acaba de crear el hecho. */
  kick(): void {
    this.dispatch().catch((error: unknown) => {
      this.deps.onError(error, { id: '', type: 'dispatch', aggregateId: '', attempts: 0 });
    });
  }

  /** Espera a que termine la ejecución en curso, si la hay. */
  async idle(): Promise<void> {
    await this.inflight?.catch(() => undefined);
  }

  /** Despacha ahora y repite cada intervalo hasta `stop`. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.kick();
    }, this.deps.intervalMs);
    this.timer.unref();
    this.kick();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.idle();
  }

  private async runUntilIdle(): Promise<ProcessSummary> {
    const total = { processed: 0, failed: 0 };
    do {
      this.rerun = false;
      const summary = await this.deps.store.processPending(
        BATCH_SIZE,
        (event) => this.handle(event),
        this.deps.clock.now(),
      );
      total.processed += summary.processed;
      total.failed += summary.failed;
      // Un fallo se reintenta en el siguiente intervalo, no en bucle
    } while (this.rerun);
    return total;
  }

  private async handle(event: PendingOutboxEvent): Promise<void> {
    try {
      const handler = this.deps.handlers[event.type];
      if (!handler) throw new Error(`No hay manejador para el hecho ${event.type}`);
      await handler(event.aggregateId);
    } catch (error) {
      this.deps.onError(error, event);
      throw error;
    }
  }
}
