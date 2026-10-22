export const SITE_NAME = 'ChangeHouse';

/** Título de página: «<página> · ChangeHouse», o solo el nombre del sitio si no hay página. */
export function pageTitle(page?: string): string {
  const trimmed = page?.trim();
  return trimmed ? `${trimmed} · ${SITE_NAME}` : SITE_NAME;
}
