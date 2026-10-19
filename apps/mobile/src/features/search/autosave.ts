export type SaveOutcome<R> =
  | { status: 'saved'; saved: R }
  | { status: 'failed'; error: unknown }
  /** Se encoló un cambio posterior antes de que le tocara: no llegó a enviarse. */
  | { status: 'superseded' };

export interface AutoSaverOptions<V, R> {
  /** Pausa sin cambios antes de guardar. */
  delayMs: number;
  /** Envía el documento entero a la API. */
  save: (value: V) => Promise<R>;
  /** Un guardado terminó bien; `latest` es `false` si ya hay un cambio posterior en camino. */
  onSaved: (saved: R, latest: boolean) => void;
  /** El último guardado falló: quien llama deshace el cambio local y avisa. */
  onFailed: (value: V, error: unknown) => void;
}

/**
 * Guardado diferido de un documento que se reemplaza entero (`PUT`): junta los cambios que llegan
 * en rápida sucesión, envía **una petición cada vez** y deja que **gane el último estado**. Un
 * fallo de un guardado ya superado por otro posterior no se notifica: el siguiente lo sustituye.
 */
export class AutoSaver<V, R = V> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: { value: V } | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  private version = 0;

  constructor(private readonly options: AutoSaverOptions<V, R>) {}

  /** Guarda `value` tras la pausa, salvo que llegue otro cambio antes. */
  schedule(value: V): void {
    this.clearTimer();
    this.pending = { value };
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.options.delayMs);
  }

  /** Guarda ya lo que esté pendiente (por ejemplo, al salir de la pantalla). */
  flush(): void {
    const pending = this.pending;
    this.cancel();
    if (pending) void this.enqueue(pending.value);
  }

  /** Descarta lo pendiente sin guardarlo. */
  cancel(): void {
    this.clearTimer();
    this.pending = null;
  }

  /** Guarda ya `value` (tras la petición en vuelo, si la hay) y espera su resultado. */
  saveNow(value: V): Promise<SaveOutcome<R>> {
    this.cancel();
    return this.enqueue(value);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private enqueue(value: V): Promise<SaveOutcome<R>> {
    this.version += 1;
    const mine = this.version;
    const job = this.tail.then(async (): Promise<SaveOutcome<R>> => {
      if (mine !== this.version) return { status: 'superseded' };
      try {
        const saved = await this.options.save(value);
        this.options.onSaved(saved, mine === this.version);
        return { status: 'saved', saved };
      } catch (error) {
        if (mine === this.version) this.options.onFailed(value, error);
        return { status: 'failed', error };
      }
    });
    this.tail = job;
    return job;
  }
}
