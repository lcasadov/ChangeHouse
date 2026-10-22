/** Error de negocio con un código estable; `interfaces/http` decide cómo se traduce. */
export abstract class DomainError extends Error {
  abstract readonly code: string;
}
