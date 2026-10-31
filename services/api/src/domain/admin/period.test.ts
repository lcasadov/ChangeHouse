import { describe, expect, it } from 'vitest';

import { resolvePeriod } from './period.js';

describe('resolvePeriod', () => {
  it('Scenario: Métricas de un mes - el periodo abarca los días naturales de Madrid, fin incluido', () => {
    const result = resolvePeriod('2026-10-01', '2026-10-31');

    expect(result).toEqual({
      success: true,
      period: {
        from: '2026-10-01',
        to: '2026-10-31',
        // Madrid está en horario de verano (UTC+2) el 1 de octubre y en el de invierno (UTC+1) el 1 de noviembre
        start: new Date('2026-09-30T22:00:00.000Z'),
        end: new Date('2026-10-31T23:00:00.000Z'),
      },
    });
  });

  it('un solo día es un periodo válido de 24 horas', () => {
    const result = resolvePeriod('2026-06-15', '2026-06-15');

    expect(result).toMatchObject({
      success: true,
      period: {
        start: new Date('2026-06-14T22:00:00.000Z'),
        end: new Date('2026-06-15T22:00:00.000Z'),
      },
    });
  });

  it('Scenario: Periodo invertido - se rechaza señalando la fecha final', () => {
    expect(resolvePeriod('2026-10-31', '2026-10-01')).toEqual({
      success: false,
      errors: [{ field: 'to', code: 'before_from' }],
    });
  });

  it('admite exactamente 366 días y rechaza uno más', () => {
    expect(resolvePeriod('2026-01-01', '2027-01-01')).toMatchObject({ success: true });
    expect(resolvePeriod('2026-01-01', '2027-01-02')).toEqual({
      success: false,
      errors: [{ field: 'to', code: 'too_long' }],
    });
  });

  it.each([
    [undefined, '2026-10-31', 'from', 'required'],
    ['2026-10-01', undefined, 'to', 'required'],
    ['2026-10-01', '', 'to', 'required'],
    ['01/10/2026', '2026-10-31', 'from', 'invalid'],
    ['2026-02-30', '2026-10-31', 'from', 'invalid'],
    ['2026-10-01', '2026-13-01', 'to', 'invalid'],
  ])('%s → %s señala %s (%s)', (from, to, field, code) => {
    expect(resolvePeriod(from, to)).toEqual({ success: false, errors: [{ field, code }] });
  });

  it('señala las dos fechas si faltan o son erróneas a la vez', () => {
    expect(resolvePeriod(undefined, 'x')).toEqual({
      success: false,
      errors: [
        { field: 'from', code: 'required' },
        { field: 'to', code: 'invalid' },
      ],
    });
  });
});
