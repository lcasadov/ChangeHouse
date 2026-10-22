/**
 * Cómo se presenta una violación al cliente: regla incumplida (422), conflicto de estado (409)
 * o recurso no visible (404).
 */
export type DomainErrorKind = 'rule' | 'conflict' | 'not_found';

/** Error de negocio con un código estable; `interfaces/http` decide cómo se traduce. */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  /** Por defecto, una regla de negocio incumplida. */
  readonly kind: DomainErrorKind = 'rule';
  /** Campos de la petición que causan la violación, si se pueden señalar. */
  fields: readonly string[] = [];
}
