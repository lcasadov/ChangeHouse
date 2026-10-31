import { DomainError, type DomainErrorKind } from '../domain-error.js';

/** Solo una denuncia abierta se resuelve o se desestima. */
export class ReportNotOpenError extends DomainError {
  readonly code = 'REPORT_NOT_OPEN';
  override readonly kind: DomainErrorKind = 'conflict';

  constructor() {
    super('La denuncia ya está resuelta o desestimada');
    this.name = 'ReportNotOpenError';
  }
}
