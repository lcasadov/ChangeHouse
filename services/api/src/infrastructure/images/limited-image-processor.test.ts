import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageProcessingBusyError } from '../../domain/home/errors.js';
import { LimitedImageProcessor, Semaphore } from './limited-image-processor.js';

const IMAGE = { data: Buffer.from('x'), contentType: 'image/webp', width: 1, height: 1 } as const;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Semaphore', () => {
  it('concede los permisos libres al instante y encola al resto en orden', async () => {
    const semaphore = new Semaphore(2);
    const first = await semaphore.acquire(1000);
    const second = await semaphore.acquire(1000);
    const order: string[] = [];
    const third = semaphore.acquire(1000).then((release) => {
      order.push('tercero');
      return release;
    });
    const fourth = semaphore.acquire(1000).then((release) => {
      order.push('cuarto');
      return release;
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(order).toEqual([]);
    first();
    await vi.advanceTimersByTimeAsync(10);
    expect(order).toEqual(['tercero']);
    second();
    await vi.advanceTimersByTimeAsync(10);
    expect(order).toEqual(['tercero', 'cuarto']);
    (await third)();
    (await fourth)();
  });

  it('Scenario: Espera agotada - tras el tiempo máximo rechaza con ImageProcessingBusyError y no deja el hueco ocupado', async () => {
    const semaphore = new Semaphore(1);
    const held = await semaphore.acquire(1000);
    const outcome = semaphore.acquire(30_000).then(
      () => 'adquirido',
      (error: unknown) => error,
    );

    await vi.advanceTimersByTimeAsync(30_000);

    expect(await outcome).toBeInstanceOf(ImageProcessingBusyError);
    held();
    // El permiso liberado sigue disponible y no se pierde en el intento que expiró
    const again = await semaphore.acquire(1000);
    again();
  });

  it('liberar dos veces el mismo permiso no crea permisos de más', async () => {
    const semaphore = new Semaphore(1);
    const release = await semaphore.acquire(1000);
    release();
    release();
    const taken = await semaphore.acquire(1000);
    const blocked = semaphore.acquire(50).then(
      () => 'adquirido',
      (error: unknown) => error,
    );

    await vi.advanceTimersByTimeAsync(50);

    expect(await blocked).toBeInstanceOf(ImageProcessingBusyError);
    taken();
  });
});

describe('LimitedImageProcessor', () => {
  it('Scenario: Procesado saturado - con 2 en curso la tercera espera y, agotada la espera, responde 503 con Retry-After', async () => {
    const releases: (() => void)[] = [];
    const inner = {
      process: () =>
        new Promise<typeof IMAGE>((resolve) => {
          releases.push(() => {
            resolve(IMAGE);
          });
        }),
    };
    const limited = new LimitedImageProcessor(inner, { permits: 2, maxWaitMs: 30_000 });

    const first = limited.process(Buffer.from('1'));
    const second = limited.process(Buffer.from('2'));
    const third = limited.process(Buffer.from('3')).then(
      () => 'procesada',
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(29_999);
    expect(releases).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);

    const error = await third;
    expect(error).toBeInstanceOf(ImageProcessingBusyError);
    expect(error).toMatchObject({ kind: 'unavailable', retryAfterSeconds: 30 });
    releases.forEach((release) => {
      release();
    });
    await Promise.all([first, second]);
  });

  it('un permiso liberado deja pasar a la que esperaba, también si el procesado anterior falló', async () => {
    let calls = 0;
    const inner = {
      process: () => {
        calls += 1;
        return calls === 1 ? Promise.reject(new Error('sharp falló')) : Promise.resolve(IMAGE);
      },
    };
    const limited = new LimitedImageProcessor(inner, { permits: 1, maxWaitMs: 30_000 });

    const failing = limited.process(Buffer.from('1')).catch((error: unknown) => error);
    const next = limited.process(Buffer.from('2'));

    expect(await failing).toMatchObject({ message: 'sharp falló' });
    await expect(next).resolves.toEqual(IMAGE);
  });
});
