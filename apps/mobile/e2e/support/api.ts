import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';

import { API_PORT } from '../scripts/environment.cjs';
import { grantAdminRole, seedReadyPhotos } from './db';

/** Contraseña de todas las cuentas de prueba (el emulador de Auth no valida su calidad). */
export const PASSWORD = 'contraseña-de-prueba';

const API = `http://localhost:${String(API_PORT)}/v1`;
const AUTH = 'http://localhost:9099/identitytoolkit.googleapis.com/v1';

let sequence = 0;
const runId = Date.now().toString(36);

/** Email único por ejecución y por cuenta, con dominio reservado: las pruebas no dependen de limpiar nada. */
export function uniqueEmail(prefix: string): string {
  sequence += 1;
  return `${prefix}-${runId}-${String(sequence)}-${String(process.pid)}@example.com`;
}

export interface Person {
  email: string;
  displayName: string;
  uid: string;
  /** Identificador interno (UUID) en la API. */
  id: string;
  idToken: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function send<T>(
  url: string,
  method: string,
  token: string | undefined,
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new ApiError(response.status, `${method} ${url} -> ${String(response.status)}: ${text}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Llamada autenticada a la API real. */
export const call = <T = unknown>(
  person: Pick<Person, 'idToken'>,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
) => send<T>(`${API}${path}`, method, person.idToken, body);

/**
 * Crea la cuenta en el emulador de Auth (sin pasar por la app) y devuelve su ID token.
 * El token es el del inicio de sesión posterior, no el del alta: el del alta puede salir con un
 * `auth_time` anterior a `validSince` y la API lo rechaza como revocado (#386).
 */
async function createAuthAccount(email: string) {
  const credentials = { email, password: PASSWORD, returnSecureToken: true };
  await send(`${AUTH}/accounts:signUp?key=fake-api-key`, 'POST', undefined, credentials);
  const result = await send<{ localId: string; idToken: string }>(
    `${AUTH}/accounts:signInWithPassword?key=fake-api-key`,
    'POST',
    undefined,
    credentials,
  );
  return { uid: result.localId, idToken: result.idToken };
}

/** Una persona ya dada de alta (cuenta de Auth + perfil con los textos legales aceptados). */
export async function registerPerson(displayName: string, prefix = 'persona'): Promise<Person> {
  const email = uniqueEmail(prefix);
  const account = await createAuthAccount(email);
  const me = await send<{ id: string }>(`${API}/me`, 'PUT', account.idToken, {
    displayName,
    acceptedTermsVersion: TERMS_VERSION,
    acceptedPrivacyVersion: PRIVACY_VERSION,
  });
  return { email, displayName, uid: account.uid, id: me.id, idToken: account.idToken };
}

/** Un administrador listo para iniciar sesión en la app. */
export async function registerAdmin(displayName = 'Admin E2E'): Promise<Person> {
  const admin = await registerPerson(displayName, 'admin');
  await grantAdminRole(admin.email);
  return admin;
}

/** Los lugares de prueba de `@changehouse/shared`: la API los resuelve sin clave de Google. */
export const PLACES = {
  malasana: { placeId: 'fixture-malasana', formatted: 'Calle del Pez, 12, 28004 Madrid, España' },
  chamberi: {
    placeId: 'fixture-chamberi',
    formatted: 'Calle de Santa Engracia, 45, 28010 Madrid, España',
  },
  lavapies: {
    placeId: 'fixture-lavapies',
    formatted: 'Calle de Argumosa, 5, 28012 Madrid, España',
  },
  alcala: {
    placeId: 'fixture-alcala',
    formatted: 'Calle Mayor, 20, 28801 Alcalá de Henares, Madrid, España',
  },
  getafe: { placeId: 'fixture-getafe', formatted: 'Calle Madrid, 8, 28901 Getafe, Madrid, España' },
} as const;

export interface HomeSeed {
  type: 'piso' | 'atico' | 'duplex' | 'estudio' | 'bajo' | 'chalet' | 'adosado' | 'casa';
  place: (typeof PLACES)[keyof typeof PLACES];
  /** Valor (mínimo = máximo) en euros. */
  valueEuros?: number;
}

export interface SeededHome {
  id: string;
}

/** Datos mínimos con los que una vivienda puede enviarse a revisión (salvo las fotos). */
export const COMPLETE_DETAILS = {
  usefulM2: 80,
  builtM2: 95,
  bedrooms: 3,
  bathrooms: 2,
  hasLift: true,
  garage: false,
  storageRoom: false,
  isPrimaryResidence: true,
} as const;

/** Vivienda completa con tres fotos, enviada a revisión (estado `in_review`). */
export async function submittedHome(owner: Person, seed: HomeSeed): Promise<SeededHome> {
  const euros = (seed.valueEuros ?? 200_000) * 100;
  const home = await call<{ id: string }>(owner, 'POST', '/homes', {
    type: seed.type,
    address: seed.place,
    ...COMPLETE_DETAILS,
    valueMinCents: euros,
    valueMaxCents: euros,
  });
  // Fotos sembradas por SQL (ver db.ts: la subida real a fake-gcs falla en local)
  await seedReadyPhotos(home.id);
  await call(owner, 'POST', `/homes/${home.id}/submit`);
  return { id: home.id };
}

export const approveHome = (admin: Person, homeId: string) =>
  call(admin, 'POST', `/admin/homes/${homeId}/moderation`, { decision: 'approve' });

/** Vivienda publicada (envío a revisión + aprobación de un administrador). */
export async function publishedHome(
  owner: Person,
  admin: Person,
  seed: HomeSeed,
): Promise<SeededHome> {
  const home = await submittedHome(owner, seed);
  await approveHome(admin, home.id);
  return home;
}

export interface SearchSeed {
  municipalities: string[];
  /** Tipos de vivienda que busca: aísla cada prueba de las viviendas de las demás. */
  types: string[];
}

export const savedSearch = (person: Person, search: SearchSeed) =>
  call(person, 'PUT', '/me/search-preferences', {
    municipalities: search.municipalities,
    filters: { types: search.types },
    maxToPayCents: 0,
    minToReceiveCents: 0,
  });

export const likeHome = (person: Person, fromHomeId: string, targetHomeId: string) =>
  call<{ match?: { id: string } | null }>(person, 'POST', '/me/likes', {
    fromHomeId,
    targetHomeId,
  });
