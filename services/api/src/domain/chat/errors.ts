import { DomainError, type DomainErrorKind } from '../domain-error.js';

/** El match existe pero su chat aún no se ha creado (el despachador lo creará): reintentar. */
export class ChatNotReadyError extends DomainError {
  readonly code = 'CHAT_NOT_READY';
  override readonly kind: DomainErrorKind = 'conflict';

  constructor() {
    super('El chat de este match aún no está listo');
    this.name = 'ChatNotReadyError';
  }
}

/** Se envía una imagen cuyo original no se ha subido (o que no es del participante). */
export class ImageNotUploadedError extends DomainError {
  readonly code = 'IMAGE_NOT_UPLOADED';

  constructor() {
    super('La imagen aún no se ha subido');
    this.name = 'ImageNotUploadedError';
  }
}

/** La imagen no existe en el chat de ese match. */
export class ChatImageNotFoundError extends DomainError {
  readonly code = 'CHAT_IMAGE_NOT_FOUND';
  override readonly kind: DomainErrorKind = 'not_found';

  constructor() {
    super('Imagen no encontrada');
    this.name = 'ChatImageNotFoundError';
  }
}
