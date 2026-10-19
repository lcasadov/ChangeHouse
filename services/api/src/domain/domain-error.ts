/** Error de negocio con un código estable; `interfaces/http` decide cómo se traduce. */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  /** Campos de la petición que causan la violación, si se pueden señalar. */
  fields: readonly string[] = [];
}
