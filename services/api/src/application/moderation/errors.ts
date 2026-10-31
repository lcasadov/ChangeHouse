import { DomainError, type DomainErrorKind } from '../../domain/domain-error.js';

/** El usuario sobre el que actúa un admin no existe. */
export class UserToModerateNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';
  override readonly kind: DomainErrorKind = 'not_found';

  constructor() {
    super('Usuario no encontrado');
    this.name = 'UserToModerateNotFoundError';
  }
}
