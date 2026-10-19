import { DomainError, type DomainErrorKind } from '../../domain/domain-error.js';

/** La vivienda propia desde la que se decide no está publicada. */
export class HomeNotPublishedError extends DomainError {
  readonly code = 'HOME_NOT_PUBLISHED';
  override readonly kind: DomainErrorKind = 'conflict';

  constructor() {
    super('La vivienda desde la que se decide no está publicada');
    this.name = 'HomeNotPublishedError';
  }
}

/** Ya existía un me gusta entre esas dos viviendas. */
export class LikeExistsError extends DomainError {
  readonly code = 'LIKE_EXISTS';
  override readonly kind: DomainErrorKind = 'conflict';

  constructor() {
    super('Ya has marcado Me gusta en esta vivienda desde la tuya');
    this.name = 'LikeExistsError';
  }
}

/** El me gusta ya forma parte de un match: no se deshace. */
export class LikeInMatchError extends DomainError {
  readonly code = 'LIKE_IN_MATCH';
  override readonly kind: DomainErrorKind = 'conflict';

  constructor() {
    super('El me gusta ya forma parte de un match');
    this.name = 'LikeInMatchError';
  }
}

/** Se superó el límite diario de me gusta (RF-45); `Retry-After` es el tiempo hasta la medianoche de Madrid. */
export class DailyLikeLimitError extends DomainError {
  readonly code = 'DAILY_LIKE_LIMIT';
  override readonly kind: DomainErrorKind = 'rate_limited';

  constructor(override readonly retryAfterSeconds: number) {
    super('Has alcanzado el límite diario de me gusta');
    this.name = 'DailyLikeLimitError';
  }
}

/** No hay ninguna acción reciente que deshacer. */
export class NothingToUndoError extends DomainError {
  readonly code = 'NOTHING_TO_UNDO';
  override readonly kind: DomainErrorKind = 'not_found';

  constructor() {
    super('No hay ninguna acción que deshacer');
    this.name = 'NothingToUndoError';
  }
}

/** Un `owner` con vivienda publicada tiene que indicar desde cuál decide. */
export class OriginHomeRequiredError extends DomainError {
  readonly code = 'HOME_ID_REQUIRED';
  override readonly kind: DomainErrorKind = 'invalid_request';

  constructor(field: 'fromHomeId' | 'homeId') {
    super('Con una vivienda publicada hay que indicar desde cuál se decide');
    this.name = 'OriginHomeRequiredError';
    this.fields = [field];
  }
}
