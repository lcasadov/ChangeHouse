/** El instante en que vuelve el cupo de me gusta: ahora más los segundos de `Retry-After`. */
export function availableAgainAt(retryAfterSeconds: number, now: number = Date.now()): Date {
  return new Date(now + retryAfterSeconds * 1000);
}

/** La hora y los minutos en 24 horas (la medianoche es «00:00»), en la zona del dispositivo salvo que se indique otra. */
export function formatLocalTime(date: Date, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}
