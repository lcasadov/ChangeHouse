import type { OriginalFile } from '../home/photo-storage.js';

/**
 * Puerto de salida: las imágenes del chat viven siempre en un espacio privado; el original subido
 * por el cliente es temporal y la versión procesada se sirve solo con URL firmadas de corta duración.
 */
export interface ChatImageStorage {
  /** URL firmada para subir (`PUT`) el original con ese tipo de contenido hasta `expiresAt`. */
  createUploadUrl(path: string, contentType: string, expiresAt: Date): Promise<string>;
  readOriginal(path: string, maxBytes: number): Promise<OriginalFile>;
  /** Guarda la imagen procesada. */
  store(path: string, data: Buffer, contentType: string): Promise<void>;
  /** Borra el objeto; que ya no exista no es un error. */
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** URL firmada de lectura, válida hasta `expiresAt`. */
  signedReadUrl(path: string, expiresAt: Date): Promise<string>;
}
