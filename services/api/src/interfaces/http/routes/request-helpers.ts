import type { Validation } from '@changehouse/shared';
import type { FastifyRequest } from 'fastify';

import { decodeCursor, type ModerationCursor } from '../../../application/moderation/cursor.js';
import { type FieldError, ValidationFailedError } from '../problem.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const INTEGER = /^\d+$/;

/** `cursor` y `limit` de un listado paginado del contrato (`Cursor` y `Limit`). */
export interface PageParams {
  cursor?: string;
  limit?: string;
}

/** Un cursor emitido por la API: siempre lleva el id (UUID) de la última fila de la página. */
function decodePosition(raw: string): ModerationCursor | null {
  const cursor = decodeCursor(raw);
  return cursor !== null && UUID.test(cursor.id) ? cursor : null;
}

/**
 * Posición y tamaño de página: `limit` entero de 1 a 50 (20 por defecto) y un `cursor` emitido por
 * la API. Cada parámetro erróneo se anota en `errors` por su nombre.
 */
export function parsePage(
  query: PageParams,
  errors: FieldError[],
): { cursor: ModerationCursor | undefined; limit: number } {
  const limit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);
  if (query.limit !== undefined && (!INTEGER.test(query.limit) || limit < 1 || limit > MAX_LIMIT)) {
    errors.push({ field: 'limit', message: 'invalid' });
  }
  const cursor = query.cursor === undefined ? undefined : decodePosition(query.cursor);
  if (cursor === null) errors.push({ field: 'cursor', message: 'invalid' });
  return { cursor: cursor ?? undefined, limit };
}

/** Datos válidos o un 400 con los campos erróneos. */
export function validated<T>(result: Validation<T>): T {
  if (result.success) return result.data;
  throw new ValidationFailedError(
    result.errors.map((error) => ({ field: error.field, message: error.code })),
  );
}

/** Id de la cuenta propia; la política ya garantizó que existe en las operaciones que lo piden. */
export function accountId(request: FastifyRequest): string {
  const account = request.principal?.account;
  if (!account) throw new Error('La operación exige una cuenta y la política no lo comprobó');
  return account.userId;
}

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** Un identificador que no es un UUID responde igual que uno que no existe: sin consultar nada. */
export function uuidOr404(value: string, notFound: () => Error): string {
  if (!UUID.test(value)) throw notFound();
  return value;
}
