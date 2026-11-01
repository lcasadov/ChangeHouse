// Content-Security-Policy de Firebase Hosting (landing y app web).
//
// `firebase.json` lleva una política base con los orígenes que no cambian entre entornos (Google).
// En el despliegue este script le añade los que sí cambian (API, Sentry, CDN de fotos), leídos de las
// variables del entorno de GitHub, y reescribe `firebase.json` justo antes de `firebase deploy`:
//   API_ORIGIN=https://api.example.app SENTRY_ORIGIN=https://o1.ingest.sentry.io node scripts/hosting-csp.mjs
// Los E2E de la web usan `withOrigins` para servir la misma política con los orígenes locales.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SITES = { landing: 'landing', app: 'app' };

/** Directivas que se amplían con orígenes de cada entorno, por sitio. */
const EXTENDABLE = {
  landing: { 'connect-src': ['API_ORIGIN', 'SENTRY_ORIGIN'] },
  app: {
    'connect-src': ['API_ORIGIN', 'SENTRY_ORIGIN', 'STORAGE_PUBLIC_ORIGIN'],
    'img-src': ['STORAGE_PUBLIC_ORIGIN'],
  },
};

/** Acepta solo orígenes `https://host[:puerto]` (o `http://localhost` en pruebas locales). */
export function parseOrigin(name, raw) {
  const value = (raw ?? '').trim();
  if (value === '') return undefined;
  const valid =
    /^[a-z]+:\/\/[a-z0-9.-]+(:\d+)?$/.test(value) &&
    URL.canParse(value) &&
    new URL(value).origin === value;
  const secure = valid && (value.startsWith('https://') || new URL(value).hostname === 'localhost');
  if (!secure)
    throw new Error(`${name} debe ser un origen https (esquema, host y puerto): ${value}`);
  return value;
}

function parsePolicy(policy) {
  return new Map(
    policy
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .filter((tokens) => tokens[0] !== '')
      .map(([name, ...sources]) => [name, sources]),
  );
}

const serialize = (directives) =>
  [...directives].map(([name, sources]) => [name, ...sources].join(' ')).join('; ');

/** Añade orígenes ya validados a una directiva (la crea si no existe). Lo usan los E2E con los orígenes locales. */
export function extendDirective(policy, directive, origins) {
  const directives = parsePolicy(policy);
  const sources = directives.get(directive) ?? [];
  for (const origin of origins) if (!sources.includes(origin)) sources.push(origin);
  directives.set(directive, sources);
  return serialize(directives);
}

/** Devuelve la política con los orígenes añadidos a las directivas ampliables del sitio. */
export function withOrigins(policy, site, origins) {
  const directives = parsePolicy(policy);
  for (const [directive, names] of Object.entries(EXTENDABLE[site] ?? {})) {
    const sources = directives.get(directive) ?? [];
    for (const name of names) {
      const origin = parseOrigin(name, origins[name]);
      if (origin !== undefined && !sources.includes(origin)) sources.push(origin);
    }
    directives.set(directive, sources);
  }
  return serialize(directives);
}

const isCsp = (header) => header.key === 'Content-Security-Policy';

/** La política base de un sitio de `firebase.json`. */
export function cspOf(config, site) {
  const entry = config.hosting.find((item) => item.target === site);
  const header = entry?.headers.flatMap((rule) => rule.headers).find(isCsp);
  if (header === undefined) throw new Error(`El sitio ${site} no tiene Content-Security-Policy`);
  return header.value;
}

/** Copia de `firebase.json` con los orígenes del entorno incorporados a la CSP de cada sitio. */
export function applyOrigins(config, origins) {
  const next = structuredClone(config);
  for (const entry of next.hosting) {
    for (const header of entry.headers.flatMap((rule) => rule.headers).filter(isCsp)) {
      header.value = withOrigins(header.value, entry.target, origins);
    }
  }
  return next;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = new URL('../firebase.json', import.meta.url);
  const origins = {
    API_ORIGIN: process.env.API_ORIGIN,
    SENTRY_ORIGIN: process.env.SENTRY_ORIGIN,
    STORAGE_PUBLIC_ORIGIN: process.env.STORAGE_PUBLIC_ORIGIN,
  };
  // En un despliegue sin API no hay formulario ni app que funcionen: mejor fallar que desplegar sin ella
  if (!origins.API_ORIGIN) throw new Error('Falta la variable API_ORIGIN');
  const result = applyOrigins(JSON.parse(readFileSync(file, 'utf8')), origins);
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write('CSP de Hosting actualizada con los orígenes del entorno\n');
}
