import { DomainError, type DomainErrorKind } from '../domain-error.js';

/** El match no admite la acción en su estado actual (por ejemplo, está cerrado). */
export class MatchNotOpenError extends DomainError {
  readonly code = 'MATCH_NOT_OPEN';
  override readonly kind: DomainErrorKind = 'conflict';

  constructor() {
    super('El match no admite esta acción en su estado actual');
    this.name = 'MatchNotOpenError';
  }
}

/** El match no existe o quien pregunta no participa en él: la respuesta es la misma (RN-08). */
export class MatchNotFoundError extends DomainError {
  readonly code = 'MATCH_NOT_FOUND';
  override readonly kind: DomainErrorKind = 'not_found';

  constructor() {
    super('Match no encontrado');
    this.name = 'MatchNotFoundError';
  }
}
