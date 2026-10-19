import sharp from 'sharp';

/** JPEG de color liso generado en la prueba: no hay ficheros de ejemplo en el repositorio. */
export function jpeg(width = 640, height = 480): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } },
  })
    .jpeg()
    .toBuffer();
}

/** JPEG con coordenadas GPS (Puerta del Sol, Madrid) y marca de cámara en sus metadatos EXIF. */
export function jpegWithGps(width = 640, height = 480): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 30, g: 90, b: 160 } },
  })
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
