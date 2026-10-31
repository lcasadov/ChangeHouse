import type { DataExporter, DataExportFile } from '../features/account/data-exporter';

/** La entrega del fichero exportado: lo guarda en memoria y puede fallar o cancelarse desde la prueba. */
export class FakeDataExporter implements DataExporter {
  readonly delivered: DataExportFile[] = [];
  /** La siguiente entrega falla (sin hoja de compartir, sin permiso…). */
  failNext = false;

  deliver(file: DataExportFile): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error('No se puede compartir'));
    }
    this.delivered.push(file);
    return Promise.resolve();
  }
}
