/** Dónde vive cada versión de una foto: el original, en el espacio privado; la procesada, en el público. */
export function originalPath(homeId: string, photoId: string): string {
  return `originals/${homeId}/${photoId}`;
}

export function publishedPath(homeId: string, photoId: string): string {
  return `homes/${homeId}/${photoId}.webp`;
}
