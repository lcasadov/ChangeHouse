/** Un sitio ofrecido por el autocompletado de la barra «¿Dónde quieres vivir?». */
export type ZoneSuggestion =
  /** Un municipio entero: se añade a `municipalities`. */
  | { kind: 'municipality'; id: string; label: string }
  /** Un barrio o lugar: fija `center` en su centro, con el radio por defecto. */
  | { kind: 'place'; id: string; label: string; center: { lat: number; lng: number } };

/**
 * Puerto de salida del autocompletado de zonas de búsqueda. Distinto del de direcciones: una zona
 * es un municipio o un punto con radio, no una dirección postal. En local y pruebas va sobre los
 * municipios y lugares de prueba, sin clave.
 */
export interface ZoneSuggestions {
  /** Sugerencias para lo escrito, sin resultados si nada coincide; rechaza si el servicio falla. */
  suggest: (query: string) => Promise<ZoneSuggestion[]>;
}
