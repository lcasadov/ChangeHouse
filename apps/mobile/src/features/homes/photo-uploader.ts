export interface PhotoUploadTarget {
  /** La URL firmada de subida (`PUT`). */
  url: string;
  /** El tipo con el que se pidió la URL: la firma exige el mismo `Content-Type`. */
  contentType: string;
  /** El fichero local elegido en la galería. */
  uri: string;
}

/** Puerto de salida del envío directo del fichero al almacenamiento, con progreso. */
export interface PhotoUploader {
  /** Rechaza si el fichero no se puede leer o el almacenamiento no lo acepta. */
  upload: (target: PhotoUploadTarget, onProgress: (ratio: number) => void) => Promise<void>;
}
