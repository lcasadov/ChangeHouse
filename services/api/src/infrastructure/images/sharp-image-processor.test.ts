import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { InvalidImageError } from '../../domain/home/errors.js';
import { MAX_INPUT_PIXELS, SharpImageProcessor } from './sharp-image-processor.js';

const MAX_SIDE = 2048;

/** Imagen de color liso: nada de ficheros de ejemplo en el repositorio, todo se genera aquí. */
function blank(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } },
  });
}

/** JPEG con coordenadas GPS (Puerta del Sol, Madrid) y marca de cámara en sus metadatos EXIF. */
async function jpegWithGps(width = 640, height = 480): Promise<Buffer> {
  return blank(width, height)
    .withExif({
      IFD0: { Make: 'Cámara de prueba' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '40/1 25/1 6/1',
        GPSLongitudeRef: 'W',
        GPSLongitude: '3/1 42/1 12/1',
      },
    })
    .jpeg()
    .toBuffer();
}

/** Los bloques (fourcc) de un contenedor RIFF/WebP, para comprobar que no queda EXIF, XMP ni ICC. */
function webpChunks(data: Buffer): string[] {
  const chunks: string[] = [];
  let offset = 12; // "RIFF" + tamaño + "WEBP"
  while (offset + 8 <= data.length) {
    chunks.push(data.toString('ascii', offset, offset + 4));
    offset += 8 + data.readUInt32LE(offset + 4) + (data.readUInt32LE(offset + 4) % 2);
  }
  return chunks;
}

const processor = new SharpImageProcessor();

describe('SharpImageProcessor', () => {
  it('Scenario: Foto con coordenadas GPS - la imagen publicada no contiene metadatos EXIF y su lado mayor no supera 2048 px', async () => {
    const original = await jpegWithGps(4000, 3000);
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const result = await processor.process(original);

    const metadata = await sharp(result.data).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(
      webpChunks(result.data).filter((chunk) => ['EXIF', 'XMP ', 'ICCP'].includes(chunk)),
    ).toEqual([]);
    expect(result.data.includes(Buffer.from('Cámara de prueba'))).toBe(false);
    expect(Math.max(metadata.width, metadata.height)).toBeLessThanOrEqual(MAX_SIDE);
  });

  it('entrega WebP y las dimensiones reales de la imagen publicada', async () => {
    const result = await processor.process(await jpegWithGps(800, 600));

    const metadata = await sharp(result.data).metadata();
    expect(result.contentType).toBe('image/webp');
    expect(metadata.format).toBe('webp');
    expect({ width: result.width, height: result.height }).toEqual({
      width: metadata.width,
      height: metadata.height,
    });
  });

  it('una imagen de 4000 px se reduce a 2048 px de lado mayor conservando la proporción', async () => {
    const result = await processor.process(await blank(4000, 3000).jpeg().toBuffer());

    expect({ width: result.width, height: result.height }).toEqual({ width: 2048, height: 1536 });
  });

  it('una imagen vertical también se limita por su lado mayor', async () => {
    const result = await processor.process(await blank(3000, 4000).png().toBuffer());

    expect({ width: result.width, height: result.height }).toEqual({ width: 1536, height: 2048 });
  });

  it('una imagen pequeña no se amplía', async () => {
    const result = await processor.process(await blank(320, 200).jpeg().toBuffer());

    expect({ width: result.width, height: result.height }).toEqual({ width: 320, height: 200 });
  });

  it('gira la imagen según su orientación EXIF antes de borrarla: una foto de móvil no sale tumbada', async () => {
    const landscape = await blank(400, 200).jpeg().withMetadata({ orientation: 6 }).toBuffer();

    const result = await processor.process(landscape);

    const metadata = await sharp(result.data).metadata();
    expect({ width: result.width, height: result.height }).toEqual({ width: 200, height: 400 });
    expect(metadata.orientation).toBeUndefined();
  });

  it.each([
    ['PNG', () => blank(100, 80).png().toBuffer()],
    ['WebP', () => blank(100, 80).webp().toBuffer()],
  ])('acepta una imagen %s', async (_format, make) => {
    const result = await processor.process(await make());

    expect({ width: result.width, height: result.height }).toEqual({ width: 100, height: 80 });
  });

  it('Scenario: Fichero que no es una imagen - lo rechaza con InvalidImageError', async () => {
    await expect(
      processor.process(Buffer.from('esto es texto, no una imagen')),
    ).rejects.toBeInstanceOf(InvalidImageError);
    await expect(processor.process(Buffer.alloc(0))).rejects.toBeInstanceOf(InvalidImageError);
  });

  it('rechaza una imagen truncada o corrupta', async () => {
    const original = await blank(600, 400).jpeg().toBuffer();

    await expect(processor.process(original.subarray(0, 200))).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });

  it('Scenario: Imagen con demasiados píxeles - el tope de entrada es de 40 megapíxeles', () => {
    expect(MAX_INPUT_PIXELS).toBe(40_000_000);
  });

  it('Scenario: Imagen con demasiados píxeles - una foto de 10.000 × 10.000 se rechaza con InvalidImageError sin procesarse', async () => {
    const huge = await blank(10_000, 10_000).png({ compressionLevel: 1 }).toBuffer();

    await expect(processor.process(huge)).rejects.toBeInstanceOf(InvalidImageError);
  });

  it('una imagen justo por debajo del tope (6.000 × 6.000 = 36 MP) se procesa', async () => {
    const large = await blank(6000, 6000).jpeg({ quality: 10 }).toBuffer();

    const result = await processor.process(large);

    expect(Math.max(result.width, result.height)).toBe(2048);
  });

  it('rechaza formatos que no son fotos admitidas, aunque sharp sepa leerlos (SVG, GIF)', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    const gif = await blank(10, 10).gif().toBuffer();

    await expect(processor.process(svg)).rejects.toBeInstanceOf(InvalidImageError);
    await expect(processor.process(gif)).rejects.toBeInstanceOf(InvalidImageError);
  });
});
