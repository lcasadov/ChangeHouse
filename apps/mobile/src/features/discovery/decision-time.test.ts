import { availableAgainAt, formatLocalTime } from './decision-time';

describe('formatLocalTime', () => {
  it.each([
    ['2026-10-19T22:00:00Z', '00:00'],
    ['2026-12-01T23:00:00Z', '00:00'],
    ['2026-10-19T08:30:00Z', '10:30'],
    ['2026-10-19T13:05:00Z', '15:05'],
  ])('%s en Madrid es %s (24 horas, medianoche como 00:00)', (iso, expected) => {
    expect(formatLocalTime(new Date(iso), 'es-ES', 'Europe/Madrid')).toBe(expected);
  });

  it('sin zona horaria usa la del dispositivo', () => {
    const instant = new Date('2026-10-19T08:30:00Z');
    const expected = new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(instant);

    expect(formatLocalTime(instant, 'es-ES')).toBe(expected);
  });
});

describe('availableAgainAt', () => {
  it('suma los segundos de Retry-After al instante actual', () => {
    const now = new Date('2026-10-19T20:00:00Z').getTime();

    expect(availableAgainAt(7200, now).toISOString()).toBe('2026-10-19T22:00:00.000Z');
  });
});
