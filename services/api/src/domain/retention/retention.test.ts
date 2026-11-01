import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { addMonths, isWaitlistPurgeDue, retentionCutoff } from './retention.js';

const at = (iso: string) => new Date(iso);

describe('addMonths', () => {
  it('suma y resta meses naturales conservando el día y la hora', () => {
    expect(addMonths(at('2026-10-31T10:30:00.000Z'), -12)).toEqual(at('2025-10-31T10:30:00.000Z'));
    expect(addMonths(at('2026-01-15T00:00:00.000Z'), 12)).toEqual(at('2027-01-15T00:00:00.000Z'));
  });

  it('si el mes de destino no tiene ese día, usa su último día', () => {
    expect(addMonths(at('2028-02-29T08:00:00.000Z'), 12)).toEqual(at('2029-02-28T08:00:00.000Z'));
    expect(addMonths(at('2026-08-31T08:00:00.000Z'), -6)).toEqual(at('2026-02-28T08:00:00.000Z'));
  });

  it('propiedad: sumar n meses y restarlos de vuelta nunca adelanta la fecha original', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01'), max: new Date('2060-01-01'), noInvalidDate: true }),
        fc.integer({ min: 0, max: 36 }),
        (date, months) => {
          expect(addMonths(addMonths(date, months), -months).getTime()).toBeLessThanOrEqual(
            date.getTime(),
          );
        },
      ),
    );
  });
});

describe('retentionCutoff', () => {
  it('Scenario: Chat de un match cerrado hace más de un año - el corte está 12 meses antes de ahora', () => {
    const now = at('2026-10-30T10:00:00.000Z');

    expect(retentionCutoff(now)).toEqual(at('2025-10-30T10:00:00.000Z'));
  });
});

describe('isWaitlistPurgeDue', () => {
  const now = at('2026-10-30T10:00:00.000Z');

  it('Scenario: Sin fecha de lanzamiento - nunca toca purgar', () => {
    expect(isWaitlistPurgeDue(undefined, now)).toBe(false);
  });

  it.each([
    ['13 meses después del lanzamiento', '2025-09-30T00:00:00.000Z', true],
    ['11 meses después del lanzamiento', '2025-11-30T00:00:00.000Z', false],
    ['justo 12 meses después (aún no pasado)', '2025-10-30T10:00:00.000Z', false],
    ['un lanzamiento futuro', '2027-01-01T00:00:00.000Z', false],
  ])('%s', (_name, launch, due) => {
    expect(isWaitlistPurgeDue(at(launch), now)).toBe(due);
  });
});
