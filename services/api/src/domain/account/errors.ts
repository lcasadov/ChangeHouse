import { DomainError, type DomainErrorKind } from '../domain-error.js';

/** Un admin no puede suspenderse a sí mismo: se quedaría sin acceso para deshacerlo. */
export class CannotSuspendSelfError extends DomainError {
  readonly code = 'CANNOT_SUSPEND_SELF';
  override readonly kind: DomainErrorKind = 'conflict';

  constructor() {
    super('Un admin no puede suspenderse a sí mismo');
    this.name = 'CannotSuspendSelfError';
  }
}

/** Un admin no se suspende sin quitarle antes el rol (design.md de `add-user-suspension`). */
export class CannotSuspendAdminError extends DomainError {
  readonly code = 'CANNOT_SUSPEND_ADMIN';
  override readonly kind: DomainErrorKind = 'conflict';

  constructor() {
    super('No se puede suspender a un admin sin quitarle antes el rol');
    this.name = 'CannotSuspendAdminError';
  }
}
