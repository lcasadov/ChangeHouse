export interface Period {
  from: string;
  to: string;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Si el texto es una fecha real con formato `AAAA-MM-DD`. */
export function isIsoDate(text: string): boolean {
  const match = ISO_DATE.exec(text);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const two = (value: number) => String(value).padStart(2, '0');

/** El periodo por defecto de las métricas: del día 1 del mes en curso a hoy. */
export function defaultPeriod(now: Date): Period {
  const prefix = `${String(now.getFullYear())}-${two(now.getMonth() + 1)}`;
  return { from: `${prefix}-01`, to: `${prefix}-${two(now.getDate())}` };
}
