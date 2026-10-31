import { DomainError, type DomainErrorKind } from '../domain-error.js';

export class InvalidValueRangeError extends DomainError {
  readonly code = 'INVALID_VALUE_RANGE';

  constructor() {
    super('El rango de valor debe cumplir mínimo > 0 y mínimo <= máximo');
    this.name = 'InvalidValueRangeError';
    this.fields = ['valueMinCents', 'valueMaxCents'];
  }
}

/** Una vivienda protegida no puede valer más que su precio máximo legal, si se conoce (RN-06). */
export class ValueAboveVppMaxLegalPriceError extends DomainError {
  readonly code = 'VALUE_ABOVE_VPP_MAX_LEGAL_PRICE';

  constructor() {
    super('El valor máximo de una vivienda protegida no puede superar su precio máximo legal');
    this.name = 'ValueAboveVppMaxLegalPriceError';
    this.fields = ['valueMaxCents'];
  }
}

/**
 * Una vivienda protegida fuera de borrador necesita la fecha de calificación definitiva (RF-14).
 * Es un dato de la ficha que falta, no una regla de negocio: 400, como fija el spec.
 */
export class VppQualificationDateRequiredError extends DomainError {
  readonly code = 'VPP_QUALIFICATION_DATE_REQUIRED';
  override readonly kind: DomainErrorKind = 'invalid_request';

  constructor() {
    super('Una vivienda protegida necesita la fecha de calificación definitiva');
    this.name = 'VppQualificationDateRequiredError';
    this.fields = ['vppQualificationDate'];
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

export class HomeNotInReviewError extends DomainError {
  readonly code = 'HOME_NOT_IN_REVIEW';
  override readonly kind: DomainErrorKind = 'conflict';

  constructor() {
    super('Solo una vivienda en revisión se puede aprobar o rechazar');
    this.name = 'HomeNotInReviewError';
  }
}

export class InvalidModerationReasonError extends DomainError {
  readonly code = 'INVALID_MODERATION_REASON';

  constructor() {
    super('El motivo del rechazo debe tener entre 1 y 1000 caracteres');
    this.name = 'InvalidModerationReasonError';
    this.fields = ['reason'];
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

export class HomeNotPausableError extends DomainError {
  readonly code = 'HOME_NOT_PAUSABLE';
  override readonly kind: DomainErrorKind = 'conflict';
  constructor() {
    super('Solo una vivienda publicada se puede pausar');
    this.name = 'HomeNotPausableError';
  }
}

export class HomeNotResumableError extends DomainError {
  readonly code = 'HOME_NOT_RESUMABLE';
  override readonly kind: DomainErrorKind = 'conflict';
  constructor() {
    super('Solo una vivienda pausada se puede reactivar');
    this.name = 'HomeNotResumableError';
  }
}
