import { DomainError, type DomainErrorKind } from '../../domain/domain-error.js';

export class IdentityEmailRequiredError extends DomainError {
  readonly code = 'IDENTITY_EMAIL_REQUIRED';

  constructor() {
    super('La identidad verificada no trae un email con el que dar de alta la cuenta');
    this.name = 'IdentityEmailRequiredError';
  }
}

export class EmailAlreadyRegisteredError extends DomainError {
  readonly code = 'EMAIL_ALREADY_REGISTERED';

  constructor() {
    super('Ya existe una cuenta con ese email');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

/** Ningún usuario con ese email (lo usa el script de administración). */
export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';
  override readonly kind: DomainErrorKind = 'not_found';

  constructor() {
    super('No existe ningún usuario con ese email');
    this.name = 'UserNotFoundError';
  }
}

export class UserHasActiveHomesError extends DomainError {
  readonly code = 'USER_HAS_ACTIVE_HOMES';
  override readonly kind: DomainErrorKind = 'conflict';

  constructor() {
    super('El usuario tiene viviendas activas: un administrador no publica viviendas');
    this.name = 'UserHasActiveHomesError';
  }
}
