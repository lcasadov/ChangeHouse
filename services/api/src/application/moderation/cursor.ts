/** Posición en un listado de moderación: el instante por el que se ordena y el id que desempata. */
export interface ModerationCursor {
  at: Date;
  id: string;
}

/** Cursor opaco para el cliente (`nextCursor`): base64url de `{ at, id }`. */
export function encodeCursor(cursor: ModerationCursor): string {
  return Buffer.from(JSON.stringify({ at: cursor.at.toISOString(), id: cursor.id })).toString(
    'base64url',
  );
}

/** El cursor tal como lo emitió `encodeCursor`; `null` si no lo es (el cliente no puede fabricarlos). */
export function decodeCursor(raw: string): ModerationCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      at?: unknown;
      id?: unknown;
    };
    if (typeof parsed.at !== 'string' || typeof parsed.id !== 'string' || parsed.id === '') {
      return null;
    }
    const at = new Date(parsed.at);
    return Number.isNaN(at.getTime()) ? null : { at, id: parsed.id };
  } catch {
    return null;
  }
}
