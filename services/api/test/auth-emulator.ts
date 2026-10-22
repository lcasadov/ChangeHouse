import { inject } from 'vitest';

export const PROJECT_ID = 'demo-changehouse';

/** Falso en local si el emulador de Auth no está arrancado; en la CI su ausencia rompe la ejecución. */
export function emulatorAvailable(): boolean {
  return inject('authEmulatorHost') !== '';
}

export interface EmulatorUser {
  uid: string;
  email: string;
  idToken: string;
}

let sequence = 0;

/** Email único por usuario: las pruebas no dependen de limpiar el emulador entre ellas. */
export function uniqueEmail(prefix = 'user'): string {
  sequence += 1;
  return `${prefix}-${String(Date.now())}-${String(sequence)}@example.com`;
}

/** Crea una cuenta real en el emulador de Auth y devuelve su ID token. */
export async function signUp(email = uniqueEmail()): Promise<EmulatorUser> {
  const host = inject('authEmulatorHost');
  const response = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'contraseña-de-prueba', returnSecureToken: true }),
    },
  );
  if (!response.ok)
    throw new Error(`El emulador de Auth rechazó el alta: ${String(response.status)}`);
  const body = (await response.json()) as { localId: string; idToken: string };
  return { uid: body.localId, email, idToken: body.idToken };
}

type Claims = Record<string, unknown>;

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

function claimsOf(token: string): Claims {
  const payload = token.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Claims;
}

/** El emulador firma con `alg: none`; reescribir los datos reproduce un token manipulado. */
export function withClaims(token: string, changes: Claims): string {
  const [header = '', , signature = ''] = token.split('.');
  return [header, encode({ ...claimsOf(token), ...changes }), signature].join('.');
}

/** El mismo token pero con la vigencia ya vencida. */
export function expiredToken(token: string): string {
  const issuedAt = Number(claimsOf(token)['iat']);
  return withClaims(token, { exp: issuedAt - 60 });
}

/** El mismo token con la firma alterada (el emulador emite tokens sin firma). */
export function tamperedToken(token: string): string {
  const [header = '', payload = ''] = token.split('.');
  return [header, payload, 'firma-alterada'].join('.');
}
