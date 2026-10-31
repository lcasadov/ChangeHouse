import type { DataExporter } from './data-exporter';

/** Web: descarga el JSON como fichero mediante un enlace temporal. */
export function createWebDataExporter(): DataExporter {
  return {
    // Un fallo síncrono del navegador (descarga bloqueada) rechaza la promesa
    deliver: ({ filename, content, mimeType = 'application/json' }) =>
      new Promise<void>((resolve) => {
        const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        try {
          link.click();
        } finally {
          link.remove();
          URL.revokeObjectURL(url);
        }
        resolve();
      }),
  };
}
