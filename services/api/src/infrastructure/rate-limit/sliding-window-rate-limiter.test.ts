import { describe, expect, it } from 'vitest';

import { SlidingWindowRateLimiter } from './sliding-window-rate-limiter.js';

const HOUR_MS = 3_600_000;
const START = new Date('2026-10-30T10:00:00.000Z');
const at = (offsetMs: number) => new Date(START.getTime() + offsetMs);

describe('SlidingWindowRateLimiter', () => {
  it('Scenario: Demasiadas imágenes en una hora - admite el límite y rechaza la siguiente indicando cuándo reintentar', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 3, windowMs: HOUR_MS });

    const decisions = [0, 1000, 2000, 3000].map((offset) => limiter.hit('ana', at(offset)));

    expect(decisions.map((decision) => decision.allowed)).toEqual([true, true, true, false]);
    // La primera sale de la ventana a la hora exacta: faltan 3597 s desde el cuarto intento
    expect(decisions[3]).toEqual({ allowed: false, retryAfterSeconds: 3597 });
  });

  it('un intento rechazado no consume cupo: pasada la hora de la primera, vuelve a admitir', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 2, windowMs: HOUR_MS });
    limiter.hit('ana', at(0));
    limiter.hit('ana', at(10_000));
    limiter.hit('ana', at(20_000));

    expect(limiter.hit('ana', at(HOUR_MS - 1)).allowed).toBe(false);
    expect(limiter.hit('ana', at(HOUR_MS)).allowed).toBe(true);
    expect(limiter.hit('ana', at(HOUR_MS + 5000)).allowed).toBe(false);
    expect(limiter.hit('ana', at(HOUR_MS + 10_000)).allowed).toBe(true);
  });

  it('cuenta por clave: un usuario no agota el cupo de otro', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: HOUR_MS });

    expect(limiter.hit('ana', at(0)).allowed).toBe(true);
    expect(limiter.hit('ana', at(1)).allowed).toBe(false);
    expect(limiter.hit('beto', at(2)).allowed).toBe(true);
  });

  it('el reintento es de al menos 1 segundo y se redondea por exceso', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: HOUR_MS });
    limiter.hit('ana', at(0));

    expect(limiter.hit('ana', at(HOUR_MS - 1))).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it('libera la memoria de las claves cuya ventana ya expiró', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: HOUR_MS });
    limiter.hit('ana', at(0));
    limiter.hit('beto', at(1));

    limiter.hit('carla', at(HOUR_MS + 10));

    expect(limiter.trackedKeys()).toBe(1);
  });
});
