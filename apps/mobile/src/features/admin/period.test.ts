import { defaultPeriod, isIsoDate } from './period';

describe('isIsoDate', () => {
  it.each(['2026-10-31', '2026-02-28', '2024-02-29'])('acepta %s', (text) => {
    expect(isIsoDate(text)).toBe(true);
  });

  it.each(['', 'ayer', '2026-13-01', '2026-02-30', '2026-2-3', '31/10/2026', '2026-10-31T10:00'])(
    'rechaza «%s»',
    (text) => {
      expect(isIsoDate(text)).toBe(false);
    },
  );
});

describe('defaultPeriod', () => {
  it('va del primer día del mes en curso a hoy', () => {
    expect(defaultPeriod(new Date(2026, 9, 17, 14, 30))).toEqual({
      from: '2026-10-01',
      to: '2026-10-17',
    });
  });

  it('el día 1 el periodo es de un solo día', () => {
    expect(defaultPeriod(new Date(2026, 0, 1))).toEqual({ from: '2026-01-01', to: '2026-01-01' });
  });
});
