import { HOME_STATUSES, type HomeStatus } from '@changehouse/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { isAcceptable, referenceValue } from './compensation.js';
import {
  type CompensationTerms,
  type CycleHome,
  cycleKey,
  evaluateCycle,
  homeIdsOfKey,
  MAX_CYCLE_LENGTH,
  MIN_CYCLE_LENGTH,
} from './cycle.js';

const EUR = 100;
const euros = (amount: number) => amount * EUR;

const OPEN_TERMS: CompensationTerms = {
  maxToPayCents: euros(1_000_000),
  minToReceiveCents: 0,
  valueReferencePct: 50,
};

/** Una vivienda publicada de valor fijo, con unos límites amplios salvo que se pidan otros. */
function cycleHome(
  homeId: string,
  valueEuros: number,
  terms: Partial<CompensationTerms> = {},
  overrides: Partial<CycleHome> = {},
): CycleHome {
  return {
    homeId,
    ownerId: `owner-${homeId}`,
    status: 'published',
    valueMinCents: euros(valueEuros),
    valueMaxCents: euros(valueEuros),
    terms: { ...OPEN_TERMS, ...terms },
    ...overrides,
  };
}

/** Rota la lista: el mismo ciclo empezando por otra vivienda. */
function rotate<T>(items: readonly T[], by: number): T[] {
  const shift = by % items.length;
  return [...items.slice(shift), ...items.slice(0, shift)];
}

const cents = fc.integer({ min: 0, max: 10_000_000_000 });
const positiveCents = fc.integer({ min: 1, max: 10_000_000_000 });
const pct = fc.integer({ min: 0, max: 100 });

const termsArbitrary: fc.Arbitrary<CompensationTerms> = fc.record({
  maxToPayCents: cents,
  minToReceiveCents: cents,
  valueReferencePct: pct,
});

/** Un ciclo de 2 o 3 viviendas publicadas, distintas y con rango de valor y límites. */
const publishedCycle: fc.Arbitrary<CycleHome[]> = fc
  .integer({ min: MIN_CYCLE_LENGTH, max: MAX_CYCLE_LENGTH })
  .chain((length) =>
    fc.array(
      fc.record({
        a: positiveCents,
        b: positiveCents,
        terms: termsArbitrary,
      }),
      { minLength: length, maxLength: length },
    ),
  )
  .map((rows) =>
    rows.map(({ a, b, terms }, index) => ({
      homeId: `home-${String(index)}`,
      ownerId: `owner-${String(index)}`,
      status: 'published' as const,
      valueMinCents: Math.min(a, b),
      valueMaxCents: Math.max(a, b),
      terms,
    })),
  );

const notPublished = fc.constantFrom(
  ...HOME_STATUSES.filter((status): status is Exclude<HomeStatus, 'published'> => {
    return status !== 'published';
  }),
);

const uuidList = fc.uniqueArray(fc.uuid(), {
  minLength: MIN_CYCLE_LENGTH,
  maxLength: MAX_CYCLE_LENGTH,
});

describe('cycleKey', () => {
  it('GIVEN el ciclo [B, A] y el ciclo [A, B] WHEN se calcula su clave THEN es la misma', () => {
    expect(cycleKey(['b-home', 'a-home'])).toBe(cycleKey(['a-home', 'b-home']));
  });

  it('son los identificadores ordenados y unidos', () => {
    expect(cycleKey(['c', 'a', 'b'])).toBe('a:b:c');
  });

  it('propiedad: es estable ante cualquier rotación del ciclo', () => {
    fc.assert(
      fc.property(uuidList, fc.nat(), (ids, by) => {
        expect(cycleKey(rotate(ids, by))).toBe(cycleKey(ids));
      }),
    );
  });

  it('propiedad: dos conjuntos de viviendas distintos tienen claves distintas', () => {
    fc.assert(
      fc.property(uuidList, uuidList, (first, second) => {
        const same = [...first].sort().join() === [...second].sort().join();
        expect(cycleKey(first) === cycleKey(second)).toBe(same);
      }),
    );
  });
});

describe('homeIdsOfKey', () => {
  it('devuelve las viviendas de una clave canónica, ordenadas', () => {
    expect(homeIdsOfKey('a:b:c')).toEqual(['a', 'b', 'c']);
  });

  it('propiedad: es la inversa de cycleKey', () => {
    fc.assert(
      fc.property(uuidList, (ids) => {
        expect(homeIdsOfKey(cycleKey(ids))).toEqual([...ids].sort());
      }),
    );
  });
});

describe('evaluateCycle', () => {
  it('Scenario: Compensación de cada uno - A vale 200.000 € y B 212.000 €: A paga 12.000 € y B los recibe', () => {
    const result = evaluateCycle([cycleHome('a', 200_000), cycleHome('b', 212_000)]);

    expect(result).toEqual({
      accepted: true,
      match: {
        type: 2,
        cycleKey: 'a:b',
        participants: [
          {
            homeId: 'a',
            userId: 'owner-a',
            givesHomeId: 'a',
            receivesHomeId: 'b',
            compensationCents: euros(12_000),
          },
          {
            homeId: 'b',
            userId: 'owner-b',
            givesHomeId: 'b',
            receivesHomeId: 'a',
            compensationCents: -euros(12_000),
          },
        ],
      },
    });
  });

  it('Scenario: Me gusta recíproco compatible - con la diferencia dentro de los límites de los dos, se acepta', () => {
    const result = evaluateCycle([
      cycleHome('a', 200_000, { maxToPayCents: euros(30_000) }),
      cycleHome('b', 220_000, { minToReceiveCents: euros(20_000) }),
    ]);

    expect(result.accepted).toBe(true);
  });

  it('Scenario: Me gusta recíproco incompatible - si el dueño de A no puede pagar la diferencia, se rechaza', () => {
    const result = evaluateCycle([
      cycleHome('a', 200_000, { maxToPayCents: euros(10_000) }),
      cycleHome('b', 212_000),
    ]);

    expect(result).toEqual({ accepted: false, reason: 'incompatible' });
  });

  it('se rechaza si quien recibe no obtiene su mínimo a recibir', () => {
    const result = evaluateCycle([
      cycleHome('a', 200_000),
      cycleHome('b', 212_000, { minToReceiveCents: euros(12_001) }),
    ]);

    expect(result).toEqual({ accepted: false, reason: 'incompatible' });
  });

  it('cada vivienda se valora con el punto de referencia de su propietario', () => {
    // A al 100 % de 200.000–220.000 y B al 0 % de 220.000–260.000: valen lo mismo
    const result = evaluateCycle([
      cycleHome(
        'a',
        200_000,
        { valueReferencePct: 100, maxToPayCents: 0 },
        { valueMaxCents: euros(220_000) },
      ),
      cycleHome(
        'b',
        220_000,
        { valueReferencePct: 0, maxToPayCents: 0 },
        { valueMaxCents: euros(260_000) },
      ),
    ]);

    expect(result).toMatchObject({
      accepted: true,
      match: { participants: [{ compensationCents: 0 }, { compensationCents: 0 }] },
    });
  });

  it.each(['draft', 'in_review', 'paused', 'in_operation', 'closed'] as const)(
    'Scenario: Vivienda ya no publicada - si una vivienda está %s, se rechaza',
    (status) => {
      const result = evaluateCycle([
        cycleHome('a', 200_000),
        cycleHome('b', 200_000, {}, { status }),
      ]);

      expect(result).toEqual({ accepted: false, reason: 'not_published' });
    },
  );

  it('sin preferencias efectivas o sin rango de valor no hay compensación posible y se rechaza', () => {
    const withoutTerms = evaluateCycle([
      cycleHome('a', 200_000),
      cycleHome('b', 200_000, {}, { terms: null }),
    ]);
    const withoutValue = evaluateCycle([
      cycleHome('a', 200_000, {}, { valueMinCents: null }),
      cycleHome('b', 200_000),
    ]);

    expect(withoutTerms).toEqual({ accepted: false, reason: 'missing_terms' });
    expect(withoutValue).toEqual({ accepted: false, reason: 'missing_terms' });
  });

  it('un ciclo de 3 reparte la compensación de cada uno según lo que da y lo que recibe', () => {
    // A → B → C → A: el dueño de A recibe B, el de B recibe C y el de C recibe A
    const result = evaluateCycle([
      cycleHome('a', 200_000),
      cycleHome('b', 210_000),
      cycleHome('c', 230_000),
    ]);

    expect(result).toMatchObject({
      accepted: true,
      match: {
        type: 3,
        cycleKey: 'a:b:c',
        participants: [
          { homeId: 'a', receivesHomeId: 'b', compensationCents: euros(10_000) },
          { homeId: 'b', receivesHomeId: 'c', compensationCents: euros(20_000) },
          { homeId: 'c', receivesHomeId: 'a', compensationCents: -euros(30_000) },
        ],
      },
    });
  });

  it.each([
    ['de una sola vivienda', [cycleHome('a', 200_000)]],
    ['de más de tres viviendas', ['a', 'b', 'c', 'd'].map((id) => cycleHome(id, 200_000))],
    ['con una vivienda repetida', [cycleHome('a', 200_000), cycleHome('a', 200_000)]],
    [
      'con un mismo propietario en dos eslabones',
      [
        cycleHome('a', 200_000),
        cycleHome('b', 200_000, {}, { ownerId: 'owner-a' }),
        cycleHome('c', 200_000),
      ],
    ],
  ])('un ciclo %s no es válido', (_name, cycle) => {
    expect(evaluateCycle(cycle)).toEqual({ accepted: false, reason: 'invalid_cycle' });
  });

  it('Scenario: Suma cero - propiedad: en cualquier ciclo aceptado las compensaciones suman 0', () => {
    fc.assert(
      fc.property(publishedCycle, (cycle) => {
        const result = evaluateCycle(cycle);
        fc.pre(result.accepted);
        if (!result.accepted) return;

        const total = result.match.participants.reduce(
          (sum, participant) => sum + participant.compensationCents,
          0,
        );
        expect(total).toBe(0);
      }),
    );
  });

  it('propiedad: ningún match acepta pagos por encima del máximo ni cobros por debajo del mínimo', () => {
    fc.assert(
      fc.property(publishedCycle, (cycle) => {
        const result = evaluateCycle(cycle);
        if (!result.accepted) return;

        for (const participant of result.match.participants) {
          const terms = cycle.find((home) => home.homeId === participant.homeId)?.terms;
          const amount = Math.abs(participant.compensationCents);
          if (participant.compensationCents > 0) {
            expect(amount).toBeLessThanOrEqual(terms?.maxToPayCents ?? -1);
          }
          if (participant.compensationCents < 0) {
            expect(amount).toBeGreaterThanOrEqual(terms?.minToReceiveCents ?? Infinity);
          }
        }
      }),
    );
  });

  it('propiedad: la compensación de cada uno es el valor que recibe menos el que entrega', () => {
    fc.assert(
      fc.property(publishedCycle, (cycle) => {
        const result = evaluateCycle(cycle);
        if (!result.accepted) return;
        const valueOf = (homeId: string) => {
          const home = cycle.find((candidate) => candidate.homeId === homeId);
          if (!home?.terms || home.valueMinCents === null || home.valueMaxCents === null) {
            throw new Error('vivienda sin valorar en un ciclo aceptado');
          }
          return referenceValue({
            valueMinCents: home.valueMinCents,
            valueMaxCents: home.valueMaxCents,
            valueReferencePct: home.terms.valueReferencePct,
          });
        };

        for (const participant of result.match.participants) {
          expect(participant.compensationCents).toBe(
            valueOf(participant.receivesHomeId) - valueOf(participant.givesHomeId),
          );
        }
      }),
    );
  });

  it('propiedad: cada vivienda se entrega una vez y se recibe una vez, siguiendo los me gusta', () => {
    fc.assert(
      fc.property(publishedCycle, (cycle) => {
        const result = evaluateCycle(cycle);
        if (!result.accepted) return;
        const { participants } = result.match;

        expect(participants.map((p) => p.givesHomeId)).toEqual(cycle.map((home) => home.homeId));
        expect(participants.map((p) => p.receivesHomeId)).toEqual(
          rotate(
            cycle.map((home) => home.homeId),
            1,
          ),
        );
        expect(participants.map((p) => p.userId)).toEqual(cycle.map((home) => home.ownerId));
        expect(result.match.type).toBe(cycle.length);
      }),
    );
  });

  it('propiedad: con dos viviendas se acepta exactamente cuando el intercambio es aceptable para los dos (RN-03, igual que el descubrimiento)', () => {
    fc.assert(
      fc.property(publishedCycle, (cycle) => {
        fc.pre(cycle.length === 2);
        const [first, second] = cycle;
        if (!first?.terms || !second?.terms) return;
        const side = (home: CycleHome, terms: CompensationTerms) => ({
          valueMinCents: home.valueMinCents ?? 0,
          valueMaxCents: home.valueMaxCents ?? 0,
          ...terms,
        });

        expect(evaluateCycle(cycle).accepted).toBe(
          isAcceptable(side(first, first.terms), side(second, second.terms)),
        );
      }),
    );
  });

  it('propiedad: rotar el ciclo no cambia la decisión, la clave ni la compensación de nadie', () => {
    fc.assert(
      fc.property(publishedCycle, fc.nat(), (cycle, by) => {
        const original = evaluateCycle(cycle);
        const rotated = evaluateCycle(rotate(cycle, by));

        expect(rotated.accepted).toBe(original.accepted);
        if (!original.accepted || !rotated.accepted) return;
        expect(rotated.match.cycleKey).toBe(original.match.cycleKey);
        const byHome = (participants: typeof original.match.participants) =>
          Object.fromEntries(participants.map((p) => [p.homeId, p.compensationCents]));
        expect(byHome(rotated.match.participants)).toEqual(byHome(original.match.participants));
      }),
    );
  });

  it('propiedad: si alguna vivienda no está publicada, nunca se acepta', () => {
    fc.assert(
      fc.property(publishedCycle, fc.nat(), notPublished, (cycle, index, status) => {
        const position = index % cycle.length;
        const altered = cycle.map((home, at) => (at === position ? { ...home, status } : home));

        expect(evaluateCycle(altered)).toEqual({ accepted: false, reason: 'not_published' });
      }),
    );
  });
});
