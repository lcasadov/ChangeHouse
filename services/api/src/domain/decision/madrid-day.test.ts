import { describe, expect, it } from 'vitest';

import { madridDay, secondsUntil } from './madrid-day.js';

const iso = (date: Date) => date.toISOString();

describe('madridDay', () => {
  it('en invierno el día natural de Madrid empieza a las 23:00 UTC de la víspera', () => {
    const day = madridDay(new Date('2026-01-15T10:30:00.000Z'));

    expect(iso(day.start)).toBe('2026-01-14T23:00:00.000Z');
    expect(iso(day.end)).toBe('2026-01-15T23:00:00.000Z');
  });

  it('en verano empieza a las 22:00 UTC de la víspera', () => {
    const day = madridDay(new Date('2026-07-15T10:30:00.000Z'));

    expect(iso(day.start)).toBe('2026-07-14T22:00:00.000Z');
    expect(iso(day.end)).toBe('2026-07-15T22:00:00.000Z');
  });

  it('las 23:30 UTC de invierno ya son el día siguiente en Madrid', () => {
    const day = madridDay(new Date('2026-01-15T23:30:00.000Z'));

    expect(iso(day.start)).toBe('2026-01-15T23:00:00.000Z');
    expect(iso(day.end)).toBe('2026-01-16T23:00:00.000Z');
  });

  it('el día en que se adelanta el reloj (29 de marzo de 2026) dura 23 horas', () => {
    const day = madridDay(new Date('2026-03-29T12:00:00.000Z'));

    expect(iso(day.start)).toBe('2026-03-28T23:00:00.000Z');
    expect(iso(day.end)).toBe('2026-03-29T22:00:00.000Z');
    expect(day.end.getTime() - day.start.getTime()).toBe(23 * 3_600_000);
  });

  it('el día en que se atrasa el reloj (25 de octubre de 2026) dura 25 horas', () => {
    const day = madridDay(new Date('2026-10-25T12:00:00.000Z'));

    expect(iso(day.start)).toBe('2026-10-24T22:00:00.000Z');
    expect(iso(day.end)).toBe('2026-10-25T23:00:00.000Z');
    expect(day.end.getTime() - day.start.getTime()).toBe(25 * 3_600_000);
  });

  it('el instante exacto de la medianoche pertenece al día que empieza', () => {
    const day = madridDay(new Date('2026-10-24T22:00:00.000Z'));

    expect(iso(day.start)).toBe('2026-10-24T22:00:00.000Z');
  });
});

describe('secondsUntil', () => {
  it('cuenta los segundos hasta el final del día, redondeando hacia arriba', () => {
    const now = new Date('2026-01-15T22:59:59.500Z');

    expect(secondsUntil(madridDay(now).end, now)).toBe(1);
  });

  it('el día del cambio de hora a las 00:30 quedan 22,5 horas, no 23,5', () => {
    const now = new Date('2026-03-28T23:30:00.000Z');

    expect(secondsUntil(madridDay(now).end, now)).toBe(22.5 * 3_600);
  });

  it('nunca devuelve menos de un segundo', () => {
    const end = new Date('2026-01-15T23:00:00.000Z');

    expect(secondsUntil(end, end)).toBe(1);
  });
});
