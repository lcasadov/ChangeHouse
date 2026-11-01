import type { ImageProcessor, ProcessedImage } from '../../application/home/image-processor.js';
import { ImageProcessingBusyError } from '../../domain/home/errors.js';

/** Procesados de imagen simultáneos por proceso: sharp decodifica en memoria, y esto la acota. */
export const IMAGE_PROCESSING_PERMITS = 2;
/** Cuánto espera un procesado a que quede un permiso libre antes de responder 503. */
export const IMAGE_PROCESSING_MAX_WAIT_MS = 30_000;
const MS_PER_SECOND = 1000;

interface Waiter {
  grant: () => void;
  timer: NodeJS.Timeout;
}

/** Semáforo de proceso con espera máxima: quien no consigue un permiso a tiempo recibe `ImageProcessingBusyError`. */
export class Semaphore {
  private available: number;
  private readonly queue: Waiter[] = [];

  constructor(permits: number) {
    this.available = permits;
  }

  /** Devuelve la función que libera el permiso (idempotente). */
  acquire(maxWaitMs: number): Promise<() => void> {
    if (this.available > 0) {
      this.available -= 1;
      return Promise.resolve(this.releaser());
    }
    return new Promise<() => void>((resolve, reject) => {
      const waiter: Waiter = {
        grant: () => {
          clearTimeout(waiter.timer);
          resolve(this.releaser());
        },
        timer: setTimeout(() => {
          this.queue.splice(this.queue.indexOf(waiter), 1);
          reject(new ImageProcessingBusyError(Math.ceil(maxWaitMs / MS_PER_SECOND)));
        }, maxWaitMs),
      };
      this.queue.push(waiter);
    });
  }

  private releaser(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.queue.shift();
      if (next) next.grant();
      else this.available += 1;
    };
  }
}

export interface LimitedImageProcessorOptions {
  permits: number;
  maxWaitMs: number;
}

/** Decora un procesador de imágenes con un semáforo: nunca hay más de `permits` procesados a la vez. */
export class LimitedImageProcessor implements ImageProcessor {
  private readonly semaphore: Semaphore;

  constructor(
    private readonly inner: ImageProcessor,
    private readonly options: LimitedImageProcessorOptions = {
      permits: IMAGE_PROCESSING_PERMITS,
      maxWaitMs: IMAGE_PROCESSING_MAX_WAIT_MS,
    },
  ) {
    this.semaphore = new Semaphore(options.permits);
  }

  async process(original: Buffer): Promise<ProcessedImage> {
    const release = await this.semaphore.acquire(this.options.maxWaitMs);
    try {
      return await this.inner.process(original);
    } finally {
      release();
    }
  }
}
