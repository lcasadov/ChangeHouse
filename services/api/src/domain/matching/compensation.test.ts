import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  classifyCompensation,
  compensationCents,
  evaluateExchange,
  type ExchangeSide,
  isAcceptable,
  referenceValue,
} from './compensation.js';

const EUR = 100;
const euros = (amount: number) => amount * EUR;

/** Un lado del intercambio con valor fijo (mínimo = máximo) y los límites indicados. */
function side(valueEuros: number, terms: Partial<ExchangeSide> = {}): ExchangeSide {
  return {
    valueMinCents: euros(valueEuros),
    valueMaxCents: euros(valueEuros),
    valueReferencePct: 50,
    maxToPayCents: 0,
    minToReceiveCents: 0,
    ...terms,
  };
}

/** Importes realistas en céntimos: hasta 100 millones de euros. */
const cents = fc.integer({ min: 0, max: 10_000_000_000 });
const positiveCents = fc.integer({ min: 1, max: 10_000_000_000 });
const pct = fc.integer({ min: 0, max: 100 });

const range = fc
  .tuple(positiveCents, positiveCents)
  .map(([a, b]) => ({ valueMinCents: Math.min(a, b), valueMaxCents: Math.max(a, b) }));

const exchangeSide: fc.Arbitrary<ExchangeSide> = fc
  .record({ range, valueReferencePct: pct, maxToPayCents: cents, minToReceiveCents: cents })
  .map(({ range: values, ...rest }) => ({ ...values, ...rest }));

describe('referenceValue', () => {
  it('es el punto del rango que elige el propietario: 50 es el punto medio', () => {
    expect(
      referenceValue({
        valueMinCents: euros(180_000),
        valueMaxCents: euros(220_000),
        valueReferencePct: 50,
      }),
    ).toBe(euros(200_000));
  });

  it('0 es el mínimo y 100 el máximo', () => {
    const values = { valueMinCents: euros(180_000), valueMaxCents: euros(220_000) };

    expect(referenceValue({ ...values, valueReferencePct: 0 })).toBe(euros(180_000));
    expect(referenceValue({ ...values, valueReferencePct: 100 })).toBe(euros(220_000));
  });

  it('se redondea al céntimo más cercano, con el medio céntimo hacia arriba', () => {
    expect(referenceValue({ valueMinCents: 1, valueMaxCents: 2, valueReferencePct: 50 })).toBe(2);
    expect(referenceValue({ valueMinCents: 1, valueMaxCents: 2, valueReferencePct: 49 })).toBe(1);
  });

  it('propiedad: es un céntimo entero dentro del rango', () => {
    fc.assert(
      fc.property(range, pct, (values, valueReferencePct) => {
        const value = referenceValue({ ...values, valueReferencePct });

        expect(Number.isSafeInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(values.valueMinCents);
        expect(value).toBeLessThanOrEqual(values.valueMaxCents);
      }),
    );
  });

  it('propiedad: subir el punto de referencia nunca baja el valor', () => {
    fc.assert(
      fc.property(range, pct, pct, (values, a, b) => {
        const [low, high] = a <= b ? [a, b] : [b, a];

        expect(referenceValue({ ...values, valueReferencePct: low })).toBeLessThanOrEqual(
          referenceValue({ ...values, valueReferencePct: high }),
        );
      }),
    );
  });
});

describe('compensationCents', () => {
  it('es el valor de la candidata menos el de la mía: positivo, pago yo', () => {
    expect(compensationCents(euros(200_000), euros(212_000))).toBe(euros(12_000));
    expect(compensationCents(euros(212_000), euros(200_000))).toBe(-euros(12_000));
  });

  it('GIVEN dos viviendas cualesquiera WHEN se calcula la compensación en ambos sentidos THEN una es la opuesta de la otra', () => {
    fc.assert(
      fc.property(cents, cents, (mine, theirs) => {
        expect(compensationCents(mine, theirs) + compensationCents(theirs, mine)).toBe(0);
      }),
    );
  });
});

describe('classifyCompensation', () => {
  it('Scenario: El usuario paga - mi vivienda vale 200.000 € y la candidata 212.000 €: pago 12.000 €', () => {
    expect(classifyCompensation(euros(200_000), euros(212_000))).toEqual({
      kind: 'pay',
      amountCents: euros(12_000),
    });
  });

  it('si la mía vale más, recibo la diferencia', () => {
    expect(classifyCompensation(euros(250_000), euros(200_000))).toEqual({
      kind: 'receive',
      amountCents: euros(50_000),
    });
  });

  it('Scenario: Cambio justo - una diferencia que no supera el 1 % del mayor de los dos valores es un cambio justo', () => {
    expect(classifyCompensation(euros(99_000), euros(100_000))).toEqual({
      kind: 'fair',
      amountCents: euros(1_000),
    });
    expect(classifyCompensation(euros(100_000), euros(99_000))).toMatchObject({ kind: 'fair' });
    expect(classifyCompensation(euros(200_000), euros(200_000))).toEqual({
      kind: 'fair',
      amountCents: 0,
    });
  });

  it('Scenario: Cambio justo - un céntimo por encima del 1 % ya no es cambio justo', () => {
    expect(classifyCompensation(euros(99_000) - 1, euros(100_000))).toEqual({
      kind: 'pay',
      amountCents: euros(1_000) + 1,
    });
  });

  it('propiedad: el importe es el valor absoluto de la diferencia y nunca es negativo', () => {
    fc.assert(
      fc.property(cents, cents, (mine, theirs) => {
        const { amountCents } = classifyCompensation(mine, theirs);

        expect(amountCents).toBe(Math.abs(theirs - mine));
      }),
    );
  });

  it('propiedad: lo que uno paga el otro lo recibe, y un cambio justo lo es para los dos', () => {
    const opposite = { pay: 'receive', receive: 'pay', fair: 'fair' } as const;
    fc.assert(
      fc.property(cents, cents, (mine, theirs) => {
        const forward = classifyCompensation(mine, theirs);
        const backward = classifyCompensation(theirs, mine);

        expect(backward).toEqual({
          kind: opposite[forward.kind],
          amountCents: forward.amountCents,
        });
      }),
    );
  });
});

describe('isAcceptable (RN-03)', () => {
  it('Scenario: Compatibles en ambos sentidos - pago 20.000 € con un máximo de 30.000 € a quien acepta recibir desde 0 €', () => {
    const mine = side(200_000, { maxToPayCents: euros(30_000) });
    const theirs = side(220_000, { minToReceiveCents: 0 });

    expect(isAcceptable(mine, theirs)).toBe(true);
  });

  it('Scenario: Compensación fuera de mis límites - una candidata que vale 60.000 € más con un máximo de 30.000 € no es aceptable', () => {
    const mine = side(200_000, { maxToPayCents: euros(30_000) });

    expect(isAcceptable(mine, side(260_000))).toBe(false);
  });

  it('GIVEN mi máximo a pagar de 30.000 € WHEN la diferencia es de 30.001 € THEN no es aceptable', () => {
    const mine = side(200_000, { maxToPayCents: euros(30_000) });

    expect(isAcceptable(mine, side(230_001))).toBe(false);
    expect(isAcceptable(mine, side(230_000))).toBe(true);
  });

  it('quien recibe debe obtener al menos su mínimo a recibir', () => {
    const mine = side(200_000, { maxToPayCents: euros(50_000) });

    expect(isAcceptable(mine, side(220_000, { minToReceiveCents: euros(20_000) }))).toBe(true);
    expect(isAcceptable(mine, side(220_000, { minToReceiveCents: euros(20_001) }))).toBe(false);
  });

  it('cuando yo recibo, aplica mi mínimo a recibir y el máximo a pagar del otro', () => {
    const mine = side(250_000, { minToReceiveCents: euros(40_000) });

    expect(isAcceptable(mine, side(200_000, { maxToPayCents: euros(50_000) }))).toBe(true);
    expect(isAcceptable(mine, side(200_000, { maxToPayCents: euros(49_999) }))).toBe(false);
    expect(isAcceptable(mine, side(215_000, { maxToPayCents: euros(50_000) }))).toBe(false);
  });

  it('con el mismo valor no hay compensación que limitar', () => {
    const mine = side(200_000, { minToReceiveCents: euros(10_000) });

    expect(isAcceptable(mine, side(200_000, { minToReceiveCents: euros(10_000) }))).toBe(true);
  });

  it('cada lado valora su vivienda con su propio punto de referencia', () => {
    // La mía, al 100 % de 200.000–220.000; la otra, al 0 % de 220.000–260.000: no hay diferencia
    const mine = { ...side(200_000), valueMaxCents: euros(220_000), valueReferencePct: 100 };
    const theirs = { ...side(220_000), valueMaxCents: euros(260_000), valueReferencePct: 0 };

    expect(evaluateExchange(mine, theirs)).toEqual({ kind: 'fair', amountCents: 0 });
  });

  it('propiedad: la aceptabilidad es la misma vista desde cualquiera de los dos lados', () => {
    fc.assert(
      fc.property(exchangeSide, exchangeSide, (mine, theirs) => {
        expect(isAcceptable(mine, theirs)).toBe(isAcceptable(theirs, mine));
      }),
    );
  });

  it('propiedad: si es aceptable, nadie paga más de su máximo ni recibe menos de su mínimo', () => {
    fc.assert(
      fc.property(exchangeSide, exchangeSide, (mine, theirs) => {
        fc.pre(isAcceptable(mine, theirs));
        const difference = compensationCents(referenceValue(mine), referenceValue(theirs));
        const [payer, receiver] = difference > 0 ? [mine, theirs] : [theirs, mine];
        const amount = Math.abs(difference);

        if (amount > 0) {
          expect(amount).toBeLessThanOrEqual(payer.maxToPayCents);
          expect(amount).toBeGreaterThanOrEqual(receiver.minToReceiveCents);
        }
      }),
    );
  });
});

describe('evaluateExchange', () => {
  it('devuelve la compensación del usuario si es aceptable para los dos', () => {
    const mine = side(200_000, { maxToPayCents: euros(30_000) });

    expect(evaluateExchange(mine, side(212_000))).toEqual({
      kind: 'pay',
      amountCents: euros(12_000),
    });
  });

  it('devuelve null si no es aceptable para alguno de los dos', () => {
    const mine = side(200_000, { maxToPayCents: euros(30_000) });

    expect(evaluateExchange(mine, side(260_000))).toBeNull();
  });

  it('propiedad: hay compensación exactamente cuando el intercambio es aceptable', () => {
    fc.assert(
      fc.property(exchangeSide, exchangeSide, (mine, theirs) => {
        expect(evaluateExchange(mine, theirs) !== null).toBe(isAcceptable(mine, theirs));
      }),
    );
  });
});
