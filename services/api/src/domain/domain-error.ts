/**
 * Cómo se presenta una violación al cliente: regla incumplida (422), conflicto de estado (409),
 * recurso no visible (404) o petición a la que le falta un dato que solo se sabe necesario al
 * consultar el estado (400).
 */
export type DomainErrorKind = 'rule' | 'conflict' | 'not_found' | 'invalid_request';

/** Error de negocio con un código estable; `interfaces/http` decide cómo se traduce. */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  /** Por defecto, una regla de negocio incumplida. */
  readonly kind: DomainErrorKind = 'rule';
  /** Campos de la petición que causan la violación, si se pueden señalar. */
  fields: readonly string[] = [];
}
