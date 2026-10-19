/** Dirección sugerida por el autocompletado; el servidor resuelve el `placeId` al guardar. */
export interface AddressSuggestion {
  placeId: string;
  formatted: string;
}

/**
 * Puerto de salida del autocompletado de direcciones. En la app va sobre Google Places y, sin
 * clave (local y pruebas), sobre los lugares de prueba compartidos con la API.
 */
export interface AddressSuggestions {
  /** Sugerencias para lo escrito, sin resultados si nada coincide; rechaza si el servicio falla. */
  suggest: (query: string) => Promise<AddressSuggestion[]>;
  /** La persona ha elegido una: termina la sesión de búsqueda (la siguiente es otra sesión). */
  endSession: () => void;
}
