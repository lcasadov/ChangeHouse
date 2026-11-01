/**
 * Cómo se presenta una violación al cliente: regla incumplida (422), conflicto de estado (409),
 * recurso no visible (404), petición a la que le falta un dato que solo se sabe necesario al
 * consultar el estado (400) límite de uso superado (429) o capacidad momentáneamente agotada (503).
 */
export type DomainErrorKind =
  'rule' | 'conflict' | 'not_found' | 'invalid_request' | 'rate_limited' | 'unavailable';

/** Error de negocio con un código estable; `interfaces/http` decide cómo se traduce. */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  /** Por defecto, una regla de negocio incumplida. */
  readonly kind: DomainErrorKind = 'rule';
  /** Campos de la petición que causan la violación, si se pueden señalar. */
  fields: readonly string[] = [];
  /** Segundos que el cliente debe esperar (`Retry-After`) cuando el error es de límite de uso. */
  readonly retryAfterSeconds?: number | undefined;
}
