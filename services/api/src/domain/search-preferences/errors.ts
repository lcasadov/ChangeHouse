import { DomainError } from '../domain-error.js';

/** Ni un municipio ni un punto con radio: sin zona no hay búsqueda posible. */
export class SearchPreferencesIncompleteError extends DomainError {
  readonly code = 'SEARCH_PREFERENCES_INCOMPLETE';

  constructor() {
    super('Hay que elegir al menos un municipio o un punto con radio');
    this.name = 'SearchPreferencesIncompleteError';
    this.fields = ['municipalities'];
  }
}
