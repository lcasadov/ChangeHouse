import type { Validation } from '@changehouse/shared';
import type { FastifyRequest } from 'fastify';

import { ValidationFailedError } from '../problem.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** Un identificador que no es un UUID responde igual que uno que no existe: sin consultar nada. */
export function uuidOr404(value: string, notFound: () => Error): string {
  if (!UUID.test(value)) throw notFound();
  return value;
}
