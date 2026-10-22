import { DomainError, type DomainErrorKind } from '../../domain/domain-error.js';

/** No hay preferencias guardadas en ese ámbito (las del usuario, o las propias de la vivienda). */
export class SearchPreferencesNotFoundError extends DomainError {
  readonly code = 'SEARCH_PREFERENCES_NOT_FOUND';
  override readonly kind: DomainErrorKind = 'not_found';

  constructor() {
    super('Preferencias de búsqueda no encontradas');
    this.name = 'SearchPreferencesNotFoundError';
  }
}
