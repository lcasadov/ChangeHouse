import { Image } from 'expo-image';

/** Calienta la caché de imágenes. Si falla no importa: la foto se pedirá cuando toque mostrarla. */
export function prefetchImage(url: string | undefined): void {
  if (!url) return;
  try {
    Promise.resolve(Image.prefetch(url)).catch(() => undefined);
  } catch {
    // Sin módulo nativo (pruebas, plataformas sin caché): no hay nada que calentar
  }
}
