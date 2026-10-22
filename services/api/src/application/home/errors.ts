import { DomainError, type DomainErrorKind } from '../../domain/domain-error.js';

/** La vivienda no existe o el usuario no puede ni saber que existe: la respuesta es la misma. */
export class HomeNotFoundError extends DomainError {
  readonly code = 'HOME_NOT_FOUND';
  override readonly kind: DomainErrorKind = 'not_found';

  constructor() {
    super('Vivienda no encontrada');
    this.name = 'HomeNotFoundError';
  }
}

export class AddressNotResolvedError extends DomainError {
  readonly code = 'ADDRESS_NOT_RESOLVED';

  constructor() {
    super('La dirección elegida no se puede situar en el mapa');
    this.name = 'AddressNotResolvedError';
    this.fields = ['address'];
  }
}
