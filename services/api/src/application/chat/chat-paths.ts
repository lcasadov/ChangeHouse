/** El original subido por un participante: temporal y atado a su match y a su cuenta. */
export function chatUploadPath(matchId: string, userId: string, uploadId: string): string {
  return `chat-uploads/${matchId}/${userId}/${uploadId}`;
}

/** La imagen ya procesada de un mensaje. */
export function chatImagePath(matchId: string, messageId: string): string {
  return `chat/${matchId}/${messageId}.webp`;
}
