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

export class InvalidImageError extends DomainError {
  readonly code = 'INVALID_IMAGE';
  constructor() {
    super('El fichero subido no es una imagen válida (JPEG, PNG, HEIC o WebP)');
    this.name = 'InvalidImageError';
  }
}

export class PhotoNotUploadedError extends DomainError {
  readonly code = 'PHOTO_NOT_UPLOADED';
  constructor() {
    super('La foto aún no se ha subido a la URL firmada');
    this.name = 'PhotoNotUploadedError';
  }
}

export class PhotoLimitReachedError extends DomainError {
  readonly code = 'PHOTO_LIMIT_REACHED';
  override readonly kind: DomainErrorKind = 'conflict';
  constructor() {
    super('Una vivienda no puede tener más de 20 fotos');
    this.name = 'PhotoLimitReachedError';
  }
}

export class HomeMinPhotosError extends DomainError {
  readonly code = 'HOME_MIN_PHOTOS';
  override readonly kind: DomainErrorKind = 'conflict';
  constructor() {
    super('Una vivienda enviada a revisión o publicada no puede quedarse con menos de 3 fotos');
    this.name = 'HomeMinPhotosError';
  }
}
