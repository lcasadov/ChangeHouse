/** El fichero de «Descargar mis datos», ya serializado. */
export interface DataExportFile {
  filename: string;
  /** Contenido ya serializado: JSON legible en la exportación de datos, CSV en la lista de espera. */
  content: string;
  /** Tipo del fichero; por defecto `application/json`. */
  mimeType?: string;
}

/**
 * Puerto de salida que entrega el fichero a la persona: la hoja de compartir en el móvil y la
 * descarga del navegador en la web. Cancelar la entrega no es un error; un fallo rechaza.
 */
export interface DataExporter {
  deliver: (file: DataExportFile) => Promise<void>;
}

export const DATA_EXPORT_FILENAME = 'changehouse-mis-datos.json';
