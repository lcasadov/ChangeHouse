// Juego de datos para probar la app a mano: personas con viviendas publicadas, con fotos, que se ven
// entre sí en Explorar. Algunas ya han dado «me gusta» a la vivienda de tu cuenta de prueba, así que
// al devolverles el «me gusta» se forma el match al momento.
//
// Requisitos: `pnpm infra:up`, `pnpm db:migrate`, `pnpm emulators` y `pnpm dev` (la API en 8080).
// Uso: pnpm seed:demo
//
// Pasa por la API real: alta en el emulador de Auth, perfil, vivienda, subida de fotos con URL firmada
// (fake-gcs), envío a revisión y aprobación de un administrador. Se puede repetir: lo que ya existe
// se conserva y solo se completa lo que falta.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const log = (text) =>
  process.stdout.write(`${text}
`);
const fail = (text) =>
  process.stderr.write(`${text}
`);

import postgres from 'postgres';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const { PRIVACY_VERSION, TERMS_VERSION } = await import(
  new URL('../packages/shared/dist/index.js', import.meta.url).href
);

function readEnv(file) {
  try {
    return Object.fromEntries(
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((line) => /^[A-Z_]+=/.test(line))
        .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
    );
  } catch {
    return {};
  }
}

const apiEnv = readEnv(join(ROOT, 'services/api/.env'));
const API = `http://localhost:${apiEnv.PORT || '8080'}/v1`;
const AUTH = `http://${apiEnv.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099'}/identitytoolkit.googleapis.com/v1`;
const DATABASE_URL =
  apiEnv.DATABASE_URL || 'postgres://changehouse:changehouse@localhost:5432/changehouse';

/** Contraseña de todas las cuentas de prueba. */
const PASSWORD = 'demo-1234';
const DOMAIN = 'demo.changehouse.test';

const PLACES = {
  malasana: { placeId: 'fixture-malasana', formatted: 'Calle del Pez, 12, 28004 Madrid, España' },
  chamberi: {
    placeId: 'fixture-chamberi',
    formatted: 'Calle de Santa Engracia, 45, 28010 Madrid, España',
  },
  retiro: { placeId: 'fixture-retiro', formatted: 'Calle de Ibiza, 30, 28009 Madrid, España' },
  lavapies: {
    placeId: 'fixture-lavapies',
    formatted: 'Calle de Argumosa, 5, 28012 Madrid, España',
  },
  alcala: {
    placeId: 'fixture-alcala',
    formatted: 'Calle Mayor, 20, 28801 Alcalá de Henares, Madrid, España',
  },
  getafe: { placeId: 'fixture-getafe', formatted: 'Calle Madrid, 8, 28901 Getafe, Madrid, España' },
};
const MUNICIPALITIES = ['Madrid', 'Alcalá de Henares', 'Getafe'];

/**
 * `likesYou`: ya ha dado «me gusta» a la vivienda de tu cuenta (`yo@…`); al devolvérselo hay match.
 * Las demás no: para el match tienes que entrar también con su cuenta (otro navegador o dispositivo).
 */
const PEOPLE = [
  {
    key: 'yo',
    name: 'Tú (cuenta de prueba)',
    color: '#3f7cac',
    home: {
      type: 'piso',
      place: PLACES.malasana,
      euros: 240_000,
      usefulM2: 78,
      builtM2: 90,
      bedrooms: 2,
      bathrooms: 1,
      floor: '3',
      hasLift: true,
      features: { balcony: true, heating: 'individual', exterior: true, condition: 'good' },
    },
  },
  {
    key: 'lucia',
    name: 'Lucía',
    color: '#c0603a',
    likesYou: true,
    home: {
      type: 'atico',
      place: PLACES.chamberi,
      euros: 260_000,
      usefulM2: 70,
      builtM2: 82,
      bedrooms: 2,
      bathrooms: 2,
      floor: '6',
      hasLift: true,
      features: {
        terrace: true,
        airConditioning: true,
        heating: 'central',
        exterior: true,
        condition: 'good',
      },
    },
  },
  {
    key: 'marcos',
    name: 'Marcos',
    color: '#5b8c51',
    likesYou: true,
    home: {
      type: 'adosado',
      place: PLACES.alcala,
      euros: 230_000,
      usefulM2: 120,
      builtM2: 140,
      bedrooms: 4,
      bathrooms: 3,
      hasLift: false,
      garage: true,
      features: { garden: true, communalPool: true, heating: 'individual', condition: 'good' },
    },
  },
  {
    key: 'carmen',
    name: 'Carmen',
    color: '#8a5a9c',
    likesYou: true,
    home: {
      type: 'duplex',
      place: PLACES.retiro,
      euros: 250_000,
      usefulM2: 95,
      builtM2: 110,
      bedrooms: 3,
      bathrooms: 2,
      floor: '4',
      hasLift: true,
      features: { terrace: true, heating: 'central', exterior: true, condition: 'new' },
    },
  },
  {
    key: 'javier',
    name: 'Javier',
    color: '#b58a2e',
    home: {
      type: 'estudio',
      place: PLACES.lavapies,
      euros: 180_000,
      usefulM2: 38,
      builtM2: 45,
      bedrooms: 0,
      bathrooms: 1,
      floor: '2',
      hasLift: false,
      features: { balcony: true, heating: 'none', condition: 'needs_renovation' },
    },
  },
  {
    key: 'elena',
    name: 'Elena',
    color: '#2f8f8f',
    home: {
      type: 'chalet',
      place: PLACES.getafe,
      euros: 300_000,
      usefulM2: 160,
      builtM2: 190,
      bedrooms: 5,
      bathrooms: 3,
      hasLift: false,
      garage: true,
      storageRoom: true,
      features: {
        garden: true,
        privatePool: true,
        airConditioning: true,
        heating: 'individual',
        condition: 'good',
      },
    },
  },
  {
    key: 'pablo',
    name: 'Pablo',
    color: '#9c4a5e',
    home: {
      type: 'bajo',
      place: PLACES.malasana,
      euros: 210_000,
      usefulM2: 65,
      builtM2: 75,
      bedrooms: 2,
      bathrooms: 1,
      floor: 'Bajo',
      hasLift: false,
      features: { accessible: true, heating: 'individual', condition: 'good' },
    },
  },
];

const ROOMS = ['Fachada', 'Salón', 'Cocina', 'Dormitorio'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function send(url, method, token, body) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok)
    throw new HttpError(response.status, `${method} ${url} -> ${response.status}: ${text}`);
  return text ? JSON.parse(text) : undefined;
}

const api = (person, method, path, body) => send(`${API}${path}`, method, person.idToken, body);

/**
 * Cuenta en el emulador de Auth con el email ya verificado; si ya existe, inicia sesión. Usa el token
 * del inicio de sesión, no el del alta (#386).
 */
async function account(email) {
  const credentials = { email, password: PASSWORD, returnSecureToken: true };
  try {
    const created = await send(
      `${AUTH}/accounts:signUp?key=fake-api-key`,
      'POST',
      undefined,
      credentials,
    );
    // API administrativa del emulador (credencial `owner`): evita el aviso «Confirma tu email»
    await send(`${AUTH}/projects/demo-changehouse/accounts:update`, 'POST', 'owner', {
      localId: created.localId,
      emailVerified: true,
    });
  } catch (error) {
    if (!(error instanceof HttpError && error.message.includes('EMAIL_EXISTS'))) throw error;
  }
  const session = await send(
    `${AUTH}/accounts:signInWithPassword?key=fake-api-key`,
    'POST',
    undefined,
    credentials,
  );
  return { uid: session.localId, idToken: session.idToken };
}

/**
 * Si los emuladores se reiniciaron sin sus datos, el usuario sigue en PostgreSQL con el uid de una
 * cuenta de Auth que ya no existe: se enlaza con la cuenta nueva (solo en local).
 */
async function relink(email, uid) {
  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => undefined });
  try {
    await sql`UPDATE users SET firebase_uid = ${uid} WHERE email = ${email}`;
  } finally {
    await sql.end();
  }
}

async function register(key, displayName) {
  const email = `${key}@${DOMAIN}`;
  const { uid, idToken } = await account(email);
  const person = { email, displayName, idToken };
  const profile = {
    displayName,
    acceptedTermsVersion: TERMS_VERSION,
    acceptedPrivacyVersion: PRIVACY_VERSION,
  };
  try {
    await api(person, 'PUT', '/me', profile);
  } catch (error) {
    if (!(error instanceof HttpError && error.message.includes('EMAIL_ALREADY_REGISTERED')))
      throw error;
    await relink(email, uid);
    await api(person, 'PUT', '/me', profile);
  }
  return person;
}

/** Foto de muestra: una ilustración sencilla de una casa con el color de la persona y la estancia. */
function photo(color, room, owner, index) {
  const sky = ['#cfe6f5', '#f5e3cf', '#e0f0d8', '#ece0f5'][index % 4];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200">
    <rect width="1600" height="1200" fill="${sky}"/>
    <rect y="900" width="1600" height="300" fill="#9cc59a"/>
    <polygon points="400,520 800,220 1200,520" fill="#7a3b2e"/>
    <rect x="460" y="520" width="680" height="420" fill="${color}"/>
    <rect x="740" y="720" width="120" height="220" fill="#4a2f22"/>
    <rect x="530" y="600" width="140" height="120" fill="#fdf6d8"/>
    <rect x="930" y="600" width="140" height="120" fill="#fdf6d8"/>
    <text x="800" y="1080" font-family="Arial, sans-serif" font-size="80" text-anchor="middle" fill="#1f2a30">${room}</text>
    <text x="800" y="140" font-family="Arial, sans-serif" font-size="56" text-anchor="middle" fill="#1f2a30">Casa de ${owner}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

async function uploadPhotos(person, homeId, config) {
  for (const [index, room] of ROOMS.entries()) {
    const upload = await api(person, 'POST', `/homes/${homeId}/photos`, {
      contentType: 'image/jpeg',
    });
    const response = await fetch(upload.uploadUrl, {
      method: 'PUT',
      // El rango de tamaño va firmado en la URL: sin esta cabecera Cloud Storage rechaza la subida
      headers: { 'content-type': 'image/jpeg', 'x-goog-content-length-range': '0,26214400' },
      body: await photo(config.color, room, config.name.split(' ')[0], index),
    });
    if (!response.ok)
      throw new Error(`La subida de la foto falló: ${response.status} ${await response.text()}`);
    await api(person, 'POST', `/homes/${homeId}/photos/${upload.photoId}/complete`);
  }
}

/** La vivienda de la persona, publicada. Si ya tiene una, la reutiliza y solo completa lo que falta. */
async function publishedHome(person, admin, config) {
  const { euros, place, ...details } = config.home;
  const [existing] = await api(person, 'GET', '/me/homes');
  let home = existing;
  if (!home) {
    home = await api(person, 'POST', '/homes', {
      ...details,
      address: place,
      garage: details.garage ?? false,
      storageRoom: details.storageRoom ?? false,
      isPrimaryResidence: true,
      valueMinCents: euros * 100,
      valueMaxCents: euros * 100,
    });
  }
  if (home.status === 'draft') {
    if ((home.photos ?? []).length < 3) await uploadPhotos(person, home.id, config);
    await api(person, 'POST', `/homes/${home.id}/submit`);
    home.status = 'in_review';
  }
  if (home.status === 'in_review') {
    await api(admin, 'POST', `/admin/homes/${home.id}/moderation`, { decision: 'approve' });
  }
  return home.id;
}

async function grantAdmin(email) {
  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => undefined });
  try {
    const rows =
      await sql`UPDATE users SET assigned_role = 'admin' WHERE email = ${email} RETURNING id`;
    if (rows.length !== 1) throw new Error(`No existe la cuenta ${email}`);
  } finally {
    await sql.end();
  }
}

async function like(person, fromHomeId, targetHomeId) {
  try {
    return await api(person, 'POST', '/me/likes', { fromHomeId, targetHomeId });
  } catch (error) {
    // Ya dado en una ejecución anterior
    if (error instanceof HttpError && error.status === 409) return undefined;
    throw error;
  }
}

try {
  await fetch(`${API}/me`);
} catch {
  fail(`La API no responde en ${API}. Arranca antes pnpm infra:up, pnpm emulators y pnpm dev.`);
  process.exit(1);
}

const adminEmail = `admin@${DOMAIN}`;
let admin = await register('admin', 'Admin de prueba');
await grantAdmin(adminEmail);
// El rol se lee de la base de datos en cada petición, pero se renueva la sesión por si acaso
admin = { ...admin, idToken: (await account(adminEmail)).idToken };

const people = {};
for (const config of PEOPLE) {
  const person = await register(config.key, config.name);
  const homeId = await publishedHome(person, admin, config);
  await api(person, 'PUT', '/me/search-preferences', {
    municipalities: MUNICIPALITIES,
    filters: {},
    maxToPayCents: 150_000 * 100,
    minToReceiveCents: 0,
  });
  people[config.key] = { person, homeId, config };
  log(`✓ ${config.name}: ${config.home.type} publicado`);
}

for (const { person, homeId, config } of Object.values(people)) {
  if (config.likesYou) await like(person, homeId, people.yo.homeId);
}

log(`
Listo. Contraseña de todas las cuentas: ${PASSWORD}

  Tu cuenta:  yo@${DOMAIN}
  Admin:      ${adminEmail}  (pestaña «Administración»)
  Ya te han dado «me gusta»: ${PEOPLE.filter((p) => p.likesYou)
    .map((p) => `${p.key}@${DOMAIN}`)
    .join(', ')}
  Sin «me gusta» todavía:    ${PEOPLE.filter((p) => p.key !== 'yo' && !p.likesYou)
    .map((p) => `${p.key}@${DOMAIN}`)
    .join(', ')}
`);
