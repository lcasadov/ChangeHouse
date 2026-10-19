/** Imagen lista para publicar: sin metadatos, orientada y dentro del tamaño máximo. */
export interface ProcessedImage {
  data: Buffer;
  contentType: 'image/webp';
  width: number;
  height: number;
}

/**
 * Puerto de salida: convierte el original que subió el usuario en la versión pública. Elimina
 * todos los metadatos (en particular la ubicación GPS), aplica la orientación, limita el lado mayor
 * y comprime. Lanza `InvalidImageError` si el fichero no es una imagen admitida.
 */
export interface ImageProcessor {
  process(original: Buffer): Promise<ProcessedImage>;
}
