import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RetentionSchedule } from './retention-schedule.js';

const DAY_MS = 24 * 3_600_000;
const SUMMARY = { ran: true, chats: 0, waitlist: 0 };

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('RetentionSchedule', () => {
  it('Scenario: Purga programada - corre al arrancar y después cada intervalo, hasta que se detiene', async () => {
    const run = vi.fn(() => Promise.resolve(SUMMARY));
    const schedule = new RetentionSchedule(run, DAY_MS, () => undefined);

    schedule.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(DAY_MS);
    expect(run).toHaveBeenCalledTimes(2);
    await schedule.stop();
    await vi.advanceTimersByTimeAsync(3 * DAY_MS);

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('arrancar dos veces no duplica el temporizador', async () => {
    const run = vi.fn(() => Promise.resolve(SUMMARY));
    const schedule = new RetentionSchedule(run, DAY_MS, () => undefined);

    schedule.start();
    schedule.start();
    await vi.advanceTimersByTimeAsync(DAY_MS);
    await schedule.stop();

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('un fallo de la purga se avisa y no detiene las siguientes ejecuciones', async () => {
    const errors: unknown[] = [];
    const run = vi
      .fn<() => Promise<typeof SUMMARY>>()
      .mockRejectedValueOnce(new Error('Firestore caído'))
      .mockResolvedValue(SUMMARY);
    const schedule = new RetentionSchedule(run, DAY_MS, (error) => errors.push(error));

    schedule.start();
    await vi.advanceTimersByTimeAsync(DAY_MS);
    await schedule.stop();

    expect(errors).toHaveLength(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('stop espera a la ejecución en curso', async () => {
    let finish: (() => void) | undefined;
    const run = vi.fn(
      () =>
        new Promise<typeof SUMMARY>((resolve) => {
          finish = () => {
            resolve(SUMMARY);
          };
        }),
    );
    const schedule = new RetentionSchedule(run, DAY_MS, () => undefined);
    schedule.start();
    await vi.advanceTimersByTimeAsync(0);
    let stopped = false;

    const stopping = schedule.stop().then(() => {
      stopped = true;
    });
    await vi.advanceTimersByTimeAsync(10);
    expect(stopped).toBe(false);
    finish?.();
    await stopping;

    expect(stopped).toBe(true);
  });
});
