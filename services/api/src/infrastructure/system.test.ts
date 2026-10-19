import { describe, expect, it } from 'vitest';

import { systemClock, uuidV7Generator } from './system.js';

describe('adaptadores del sistema', () => {
  it('el reloj devuelve la hora actual', () => {
    const before = Date.now();

    const now = systemClock.now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it('el generador devuelve UUID v7 distintos', () => {
    const first = uuidV7Generator.next();
    const second = uuidV7Generator.next();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });
});
