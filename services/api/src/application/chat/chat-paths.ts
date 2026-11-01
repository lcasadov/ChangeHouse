/** El original subido por un participante: temporal y atado a su match y a su cuenta. */
export function chatUploadPath(matchId: string, userId: string, uploadId: string): string {
  return `chat-uploads/${matchId}/${userId}/${uploadId}`;
}

/** Prefijo de los originales subidos de un match. */
export function chatUploadPrefix(matchId: string): string {
  return `chat-uploads/${matchId}/`;
}

/** Prefijo de las imágenes procesadas de un match. */
export function chatImagePrefix(matchId: string): string {
  return `chat/${matchId}/`;
}

/** La imagen ya procesada de un mensaje. */
export function chatImagePath(matchId: string, messageId: string): string {
  return `chat/${matchId}/${messageId}.webp`;
}
