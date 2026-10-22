import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { InvalidValueRangeError } from './errors.js';
import { assertValueRange } from './money.js';

function rejects(min: number | null, max: number | null): boolean {
  try {
    assertValueRange(min, max);
    return false;
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidValueRangeError);
    return true;
  }
}

describe('assertValueRange', () => {
  it('Scenario: Rango de valor incoherente - un mínimo mayor que el máximo se rechaza señalando los dos campos', () => {
    expect(() => {
      assertValueRange(300_000_00, 200_000_00);
    }).toThrow(InvalidValueRangeError);

    try {
      assertValueRange(300_000_00, 200_000_00);
    } catch (error) {
      expect((error as InvalidValueRangeError).fields).toEqual(['valueMinCents', 'valueMaxCents']);
    }
  });

  it('un mínimo de cero se rechaza, también sin máximo', () => {
    expect(rejects(0, 100)).toBe(true);
    expect(rejects(0, null)).toBe(true);
  });

  it('un máximo de cero se rechaza aunque falte el mínimo', () => {
    expect(rejects(null, 0)).toBe(true);
  });

  it('acepta un rango coherente, uno de un solo valor y uno aún sin rellenar', () => {
    expect(rejects(100, 100)).toBe(false);
    expect(rejects(100, 200)).toBe(false);
    expect(rejects(100, null)).toBe(false);
    expect(rejects(null, 200)).toBe(false);
    expect(rejects(null, null)).toBe(false);
  });

  it('un importe que no es un entero seguro se rechaza', () => {
    expect(rejects(1.5, 10)).toBe(true);
    expect(rejects(1, Number.MAX_SAFE_INTEGER + 2)).toBe(true);
  });

  it('propiedad: un rango completo es válido si y solo si min > 0 y min <= max', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -5, max: 50 }),
        fc.integer({ min: -5, max: 50 }),
        (min, max) => {
          expect(rejects(min, max)).toBe(!(min > 0 && min <= max));
        },
      ),
    );
  });
});
