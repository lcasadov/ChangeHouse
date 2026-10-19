import { DomainError, type DomainErrorKind } from '../domain-error.js';

export class InvalidValueRangeError extends DomainError {
  readonly code = 'INVALID_VALUE_RANGE';

  constructor() {
    super('El rango de valor debe cumplir mínimo > 0 y mínimo <= máximo');
    this.name = 'InvalidValueRangeError';
    this.fields = ['valueMinCents', 'valueMaxCents'];
  }
}

export class HomeNotEditableError extends DomainError {
  readonly code = 'HOME_NOT_EDITABLE';
  override readonly kind: DomainErrorKind = 'conflict';

  constructor() {
    super('Una vivienda en operación o cerrada no se puede modificar');
    this.name = 'HomeNotEditableError';
  }
}

export class HomeNotSubmittableError extends DomainError {
  readonly code = 'HOME_NOT_SUBMITTABLE';
  override readonly kind: DomainErrorKind = 'conflict';

  constructor() {
    super('Solo una vivienda en borrador se puede enviar a revisión');
    this.name = 'HomeNotSubmittableError';
  }
}

export class HomeIncompleteError extends DomainError {
  readonly code = 'HOME_INCOMPLETE';

  constructor(missing: readonly string[]) {
    super('Faltan datos obligatorios para enviar la vivienda a revisión');
    this.name = 'HomeIncompleteError';
    this.fields = missing;
  }
}
