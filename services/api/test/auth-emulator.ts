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

const PASSWORD = 'contraseña-de-prueba';

async function identityToolkit(operation: string, body: object): Promise<Response> {
  const host = inject('authEmulatorHost');
  return fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:${operation}?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, returnSecureToken: true }),
    },
  );
}

/**
 * Crea una cuenta real en el emulador de Auth y devuelve su ID token.
 *
 * El token del alta no se usa: el emulador fija su `auth_time` con la hora de entrada y `validSince`
 * después de calcular el hash de la contraseña. Si entre ambas cambia el segundo, `firebase-admin`
 * (que con el emulador siempre comprueba la revocación) lo da por revocado y la API responde 401
 * (#386). El inicio de sesión posterior emite un token con `auth_time` ≥ `validSince`.
 */
export async function signUp(email = uniqueEmail()): Promise<EmulatorUser> {
  const created = await identityToolkit('signUp', { email, password: PASSWORD });
  if (!created.ok)
    throw new Error(`El emulador de Auth rechazó el alta: ${String(created.status)}`);
  const signedIn = await identityToolkit('signInWithPassword', { email, password: PASSWORD });
  if (!signedIn.ok)
    throw new Error(`El emulador de Auth rechazó el inicio de sesión: ${String(signedIn.status)}`);
  const body = (await signedIn.json()) as { localId: string; idToken: string };
  return { uid: body.localId, email, idToken: body.idToken };
}

/** Marca el email de la cuenta como verificado en el emulador (API administrativa, credencial `owner`). */
export async function verifyEmail(user: Pick<EmulatorUser, 'uid'>): Promise<void> {
  const host = inject('authEmulatorHost');
  const response = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
      body: JSON.stringify({ localId: user.uid, emailVerified: true }),
    },
  );
  if (!response.ok)
    throw new Error(`El emulador de Auth rechazó la verificación: ${String(response.status)}`);
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

/** ¿Sigue existiendo la cuenta en el emulador de Auth? (API administrativa, credencial `owner`). */
export async function authUserExists(uid: string): Promise<boolean> {
  const host = inject('authEmulatorHost');
  const response = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:lookup`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
      body: JSON.stringify({ localId: [uid] }),
    },
  );
  if (!response.ok)
    throw new Error(`El emulador de Auth rechazó la consulta: ${String(response.status)}`);
  const body = (await response.json()) as { users?: unknown[] };
  return (body.users?.length ?? 0) > 0;
}
