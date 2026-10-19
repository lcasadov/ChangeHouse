const TIME_ZONE = 'Europe/Madrid';
const MS_PER_SECOND = 1000;

/** Día natural de Madrid como intervalo de instantes `[start, end)`. */
export interface DayWindow {
  readonly start: Date;
  readonly end: Date;
}

const calendar = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

function localFields(instant: number): Record<string, number> {
  const fields: Record<string, number> = {};
  for (const part of calendar.formatToParts(new Date(instant))) {
    if (part.type !== 'literal') fields[part.type] = Number(part.value);
  }
  return fields;
}

/** Diferencia en milisegundos entre la hora de pared de Madrid y UTC en ese instante. */
function offsetAt(instant: number): number {
  const f = localFields(instant);
  const wall = Date.UTC(
    f['year'] ?? 0,
    (f['month'] ?? 1) - 1,
    f['day'] ?? 1,
    f['hour'],
    f['minute'],
    f['second'],
  );
  return wall - Math.floor(instant / MS_PER_SECOND) * MS_PER_SECOND;
}

/**
 * Instante en que empieza el día de calendario (año, mes, día) en Madrid. Los cambios de hora ocurren
 * a la 01:00 UTC, nunca en la medianoche local: el desfase vigente a las 00:00 UTC de esa fecha es el
 * de la medianoche de Madrid.
 */
function midnightOf(year: number, month: number, day: number): Date {
  const utcMidnight = Date.UTC(year, month, day);
  return new Date(utcMidnight - offsetAt(utcMidnight));
}

/** El día natural de Madrid que contiene `now`, con los cambios de horario incluidos. */
export function madridDay(now: Date): DayWindow {
  const f = localFields(now.getTime());
  const year = f['year'] ?? 0;
  const month = (f['month'] ?? 1) - 1;
  const day = f['day'] ?? 1;
  return { start: midnightOf(year, month, day), end: midnightOf(year, month, day + 1) };
}

/** Segundos enteros (por exceso, al menos 1) desde `now` hasta `end`: el valor de `Retry-After`. */
export function secondsUntil(end: Date, now: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / MS_PER_SECOND));
}
