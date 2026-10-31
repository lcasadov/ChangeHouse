import { madridDay } from '../decision/madrid-day.js';

/** Un periodo no puede abarcar más días (ambos extremos incluidos): acota el coste de los agregados. */
export const MAX_PERIOD_DAYS = 366;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;
const NOON_UTC = 12;

/** Periodo de métricas: días naturales de Madrid de `from` a `to`, ambos incluidos; `end` es exclusivo. */
export interface Period {
  from: string;
  to: string;
  start: Date;
  end: Date;
}

export interface PeriodError {
  field: 'from' | 'to';
  code: 'required' | 'invalid' | 'before_from' | 'too_long';
}

export type PeriodResult =
  { success: true; period: Period } | { success: false; errors: PeriodError[] };

/** El día de calendario como mediodía UTC, o `null` si no es una fecha real `AAAA-MM-DD`. */
function calendarDate(value: string): Date | null {
  const match = ISO_DATE.exec(value);
  if (match === null) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day, NOON_UTC));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? date : null;
}

function check(
  field: PeriodError['field'],
  value: string | undefined,
): { date: Date } | { error: PeriodError } {
  if (value === undefined || value === '') return { error: { field, code: 'required' } };
  const date = calendarDate(value);
  return date === null ? { error: { field, code: 'invalid' } } : { date };
}

/**
 * Valida y resuelve el periodo en días naturales de Madrid. Una fecha final anterior a la inicial o
 * un periodo de más de 366 días se rechazan señalando `to`.
 */
export function resolvePeriod(from: string | undefined, to: string | undefined): PeriodResult {
  const first = check('from', from);
  const last = check('to', to);
  const errors = [first, last].flatMap((found) => ('error' in found ? [found.error] : []));
  if (!('date' in first) || !('date' in last)) return { success: false, errors };

  const days = Math.round((last.date.getTime() - first.date.getTime()) / MS_PER_DAY) + 1;
  if (days < 1) return { success: false, errors: [{ field: 'to', code: 'before_from' }] };
  if (days > MAX_PERIOD_DAYS)
    return { success: false, errors: [{ field: 'to', code: 'too_long' }] };
  return {
    success: true,
    period: {
      from: from ?? '',
      to: to ?? '',
      start: madridDay(first.date).start,
      end: madridDay(last.date).end,
    },
  };
}
