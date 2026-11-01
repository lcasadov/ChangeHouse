/** Plazo de conservación del chat (desde el cierre del match) y de la lista de espera (desde el lanzamiento). */
export const RETENTION_MONTHS = 12;

/**
 * Suma `months` meses naturales (en UTC) conservando día y hora; si el mes de destino no tiene ese
 * día, queda en su último día (29 de febrero + 12 meses = 28 de febrero).
 */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date);
  const day = target.getUTCDate();
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

/** Los chats de matches cerrados antes de este instante han superado su plazo de conservación. */
export function retentionCutoff(now: Date): Date {
  return addMonths(now, -RETENTION_MONTHS);
}

/** La lista de espera se purga pasados 12 meses del lanzamiento; sin fecha de lanzamiento, nunca. */
export function isWaitlistPurgeDue(launchDate: Date | undefined, now: Date): boolean {
  return (
    launchDate !== undefined && now.getTime() > addMonths(launchDate, RETENTION_MONTHS).getTime()
  );
}
