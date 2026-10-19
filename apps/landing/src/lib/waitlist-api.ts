import type { FieldError, FieldErrorCode, WaitlistInput } from '@changehouse/shared';

export type WaitlistValues = WaitlistInput;

export type SubmitResult =
  | { kind: 'accepted' }
  | { kind: 'rejected'; errors: FieldError[] }
  | { kind: 'rate-limited' }
  | { kind: 'unavailable' };

export interface SubmitDependencies {
  /** URL base de la API (`PUBLIC_API_URL`). */
  apiUrl: string;
  fetch?: typeof fetch;
}

const REQUEST_TIMEOUT_MS = 15_000;
const KNOWN_CODES: readonly string[] = [
  'required',
  'invalid',
  'too_long',
] satisfies FieldErrorCode[];

function asCode(message: unknown): FieldErrorCode {
  return KNOWN_CODES.includes(message as string) ? (message as FieldErrorCode) : 'invalid';
}

async function fieldErrorsOf(response: Response): Promise<FieldError[]> {
  const body = (await response.json().catch(() => null)) as {
    errors?: { field?: unknown; message?: unknown }[];
  } | null;
  return (body?.errors ?? [])
    .filter((error) => typeof error.field === 'string')
    .map((error) => ({ field: error.field as string, code: asCode(error.message) }));
}

/**
 * Envía el alta a `POST /waitlist` (`joinWaitlist`). Nunca lanza: traduce cada desenlace a un
 * resultado que la interfaz sabe explicar (aceptada, campos erróneos, límite o fallo).
 */
export async function submitWaitlist(
  values: WaitlistValues,
  dependencies: SubmitDependencies,
): Promise<SubmitResult> {
  const send = dependencies.fetch ?? fetch;
  const url = `${dependencies.apiUrl.replace(/\/+$/, '')}/waitlist`;

  try {
    const response = await send(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 202) return { kind: 'accepted' };
    if (response.status === 429) return { kind: 'rate-limited' };
    if (response.status === 400) {
      const errors = await fieldErrorsOf(response);
      if (errors.length > 0) return { kind: 'rejected', errors };
    }
    return { kind: 'unavailable' };
  } catch {
    // Sin red, tiempo agotado o respuesta cortada: el visitante solo necesita saber que puede reintentar
    return { kind: 'unavailable' };
  }
}
