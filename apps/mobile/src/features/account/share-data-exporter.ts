import { Share } from 'react-native';

import type { DataExporter } from './data-exporter';

/** Móvil: abre la hoja de compartir del sistema con el JSON (guardar en Archivos, enviar por email…). */
export function createShareDataExporter(): DataExporter {
  return {
    async deliver({ filename, content }) {
      await Share.share({ message: content, title: filename });
    },
  };
}
