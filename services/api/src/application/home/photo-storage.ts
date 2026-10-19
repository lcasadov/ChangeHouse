/** Resultado de leer un original subido: no existe, es demasiado grande o su contenido. */
export type OriginalFile =
  { status: 'found'; data: Buffer } | { status: 'missing' } | { status: 'too_large' };

/**
 * Puerto de salida: almacenamiento de objetos. Los originales viven en un espacio privado y
 * temporal; las fotos procesadas, en uno público (RNF-03). Las rutas las decide el caso de uso.
 */
export interface PhotoStorage {
  /** URL firmada para subir (`PUT`) el original con ese tipo de contenido hasta `expiresAt`. */
  createUploadUrl(path: string, contentType: string, expiresAt: Date): Promise<string>;
  /** Lee el original sin descargarlo si pesa más de `maxBytes`. */
  readOriginal(path: string, maxBytes: number): Promise<OriginalFile>;
  /** Guarda la foto procesada en el espacio público. */
  publish(path: string, data: Buffer, contentType: string): Promise<void>;
  /** Borra el original; que ya no exista no es un error. */
  deleteOriginal(path: string): Promise<void>;
  /** Borra la foto publicada; que ya no exista no es un error. */
  deletePublished(path: string): Promise<void>;
  /** URL pública de una foto publicada. */
  publicUrl(path: string): string;
}
