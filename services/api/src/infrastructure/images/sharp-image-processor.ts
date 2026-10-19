import sharp from 'sharp';

import type { ImageProcessor, ProcessedImage } from '../../application/home/image-processor.js';
import { InvalidImageError } from '../../domain/home/errors.js';

/** Lado mayor máximo de la foto publicada (RF-11). */
export const MAX_PHOTO_SIDE = 2048;
const WEBP_QUALITY = 80;
/** Formatos de foto admitidos; `heif` cubre HEIC y AVIF. Otros (SVG, GIF, TIFF…) no son fotos de vivienda. */
const ACCEPTED_FORMATS: readonly string[] = ['jpeg', 'png', 'webp', 'heif'];
/** Tope de píxeles de entrada: protege la memoria del servidor frente a imágenes diseñadas para agotarla. */
const MAX_INPUT_PIXELS = 100_000_000;

/**
 * `sharp` no copia los metadatos a la salida salvo que se le pida (`withMetadata`): ni EXIF, ni XMP,
 * ni perfil ICC. Se gira antes por la orientación EXIF para que la foto no salga tumbada.
 */
export class SharpImageProcessor implements ImageProcessor {
  async process(original: Buffer): Promise<ProcessedImage> {
    try {
      const input = sharp(original, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS });
      const { format } = await input.metadata();
      if (!ACCEPTED_FORMATS.includes(format)) throw new InvalidImageError();
      const { data, info } = await input
        .rotate()
        .resize({
          width: MAX_PHOTO_SIDE,
          height: MAX_PHOTO_SIDE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      return { data, contentType: 'image/webp', width: info.width, height: info.height };
    } catch (error) {
      // Cualquier fallo al leer o decodificar el fichero es un fichero inválido, no un fallo del servidor
      throw error instanceof InvalidImageError ? error : new InvalidImageError();
    }
  }
}
