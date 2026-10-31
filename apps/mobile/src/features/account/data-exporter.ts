/** El fichero de «Descargar mis datos», ya serializado. */
export interface DataExportFile {
  filename: string;
  /** JSON legible de la exportación. */
  content: string;
}

/**
 * Puerto de salida que entrega el fichero a la persona: la hoja de compartir en el móvil y la
 * descarga del navegador en la web. Cancelar la entrega no es un error; un fallo rechaza.
 */
export interface DataExporter {
  deliver: (file: DataExportFile) => Promise<void>;
}

export const DATA_EXPORT_FILENAME = 'changehouse-mis-datos.json';
