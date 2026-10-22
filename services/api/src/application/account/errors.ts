import { DomainError } from '../../domain/domain-error.js';

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
