/** Tipos de vivienda (lista cerrada de `HomeType` en `docs/api/openapi.yaml`). */
export const HOME_TYPES = [
  'piso',
  'atico',
  'duplex',
  'estudio',
  'bajo',
  'chalet',
  'adosado',
  'pareado',
  'casa',
] as const;

export type HomeType = (typeof HOME_TYPES)[number];
