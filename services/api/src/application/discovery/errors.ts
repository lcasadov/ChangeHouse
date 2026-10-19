import { DomainError, type DomainErrorKind } from '../../domain/domain-error.js';

/** Un `owner` con varias viviendas publicadas tiene que decir desde cuál busca. */
export class HomeIdRequiredError extends DomainError {
  readonly code = 'HOME_ID_REQUIRED';
  override readonly kind: DomainErrorKind = 'invalid_request';

  constructor() {
    super('Con varias viviendas publicadas hay que indicar desde cuál se busca');
    this.name = 'HomeIdRequiredError';
    this.fields = ['homeId'];
  }
}

/** Sin preferencias de búsqueda (las de la vivienda o las del usuario) no hay descubrimiento. */
export class SearchPreferencesRequiredError extends DomainError {
  readonly code = 'SEARCH_PREFERENCES_REQUIRED';

  constructor() {
    super('Hay que definir las preferencias de búsqueda antes de descubrir viviendas');
    this.name = 'SearchPreferencesRequiredError';
  }
}
