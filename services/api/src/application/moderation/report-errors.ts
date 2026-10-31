import { DomainError, type DomainErrorKind } from '../../domain/domain-error.js';

/** El objetivo no existe o el denunciante no puede verlo: la respuesta es la misma. */
export class ReportTargetNotFoundError extends DomainError {
  readonly code = 'REPORT_TARGET_NOT_FOUND';
  override readonly kind: DomainErrorKind = 'not_found';

  constructor() {
    super('Objetivo de la denuncia no encontrado');
    this.name = 'ReportTargetNotFoundError';
  }
}

export class CannotReportSelfError extends DomainError {
  readonly code = 'CANNOT_REPORT_SELF';
  override readonly kind: DomainErrorKind = 'invalid_request';

  constructor() {
    super('No se puede denunciar lo propio');
    this.name = 'CannotReportSelfError';
    this.fields = ['targetId'];
  }
}

export class CannotBlockSelfError extends DomainError {
  readonly code = 'CANNOT_BLOCK_SELF';
  override readonly kind: DomainErrorKind = 'invalid_request';

  constructor() {
    super('No se puede bloquear a uno mismo');
    this.name = 'CannotBlockSelfError';
    this.fields = ['userId'];
  }
}

export class UserToBlockNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';
  override readonly kind: DomainErrorKind = 'not_found';

  constructor() {
    super('Usuario no encontrado');
    this.name = 'UserToBlockNotFoundError';
  }
}

export class ReportNotFoundError extends DomainError {
  readonly code = 'REPORT_NOT_FOUND';
  override readonly kind: DomainErrorKind = 'not_found';

  constructor() {
    super('Denuncia no encontrada');
    this.name = 'ReportNotFoundError';
  }
}
