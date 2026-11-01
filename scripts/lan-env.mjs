// Prepara los .env locales para probar la app desde un móvil de la misma Wi-Fi (Expo Go).
// Uso: pnpm lan:env            → detecta la IP del PC en la red local
//      pnpm lan:env 192.168.1.40 → usa esa IP
//      pnpm lan:env --reset     → vuelve a localhost
// Crea los .env desde .env.example si no existen y solo cambia las claves de hosts; el resto se conserva.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

const log = (text) =>
  process.stdout.write(`${text}
`);
const fail = (text) =>
  process.stderr.write(`${text}
`);

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const VIRTUAL = /vethernet|wsl|docker|virtualbox|vmware|hyper-v|loopback|tailscale|zerotier/i;

function lanAddress() {
  const candidates = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    if (VIRTUAL.test(name)) continue;
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address)) {
        candidates.push({ name, ip: address.address });
      }
    }
  }
  // Las redes domésticas suelen ser 192.168.x.x: se prefieren a las corporativas o de VPN
  candidates.sort(
    (a, b) => Number(b.ip.startsWith('192.168.')) - Number(a.ip.startsWith('192.168.')),
  );
  return candidates;
}

function upsert(file, values, obsolete = []) {
  const example = `${file}.example`;
  if (!existsSync(file)) {
    if (existsSync(example)) copyFileSync(example, file);
    else writeFileSync(file, '');
  }
  let text = readFileSync(file, 'utf8');
  for (const key of obsolete) text = text.replace(new RegExp(`^${key}=.*\r?\n?`, 'm'), '');
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^#?\\s*${key}=.*$`, 'm');
    text = pattern.test(text)
      ? text.replace(pattern, line)
      : `${text.replace(/\n?$/, '\n')}${line}\n`;
  }
  writeFileSync(file, text);
}

const argument = process.argv[2];
let host = 'localhost';
if (argument && argument !== '--reset') {
  host = argument;
} else if (!argument) {
  const found = lanAddress();
  if (found.length === 0) {
    fail('No encuentro una IP de red local. Pásala a mano: pnpm lan:env 192.168.1.40');
    process.exit(1);
  }
  host = found[0].ip;
  if (found.length > 1) {
    log(`Varias IP posibles: ${found.map((f) => `${f.ip} (${f.name})`).join(', ')}. Uso ${host}.`);
  }
}

upsert(join(ROOT, '.env'), { FAKE_GCS_PUBLIC_HOST: `${host}:4443` });
// STORAGE_EMULATOR_HOST se renombró a FAKE_GCS_HOST (#379): con ella la API no arranca
upsert(join(ROOT, 'services/api/.env'), { FAKE_GCS_HOST: `${host}:4443` }, [
  'STORAGE_EMULATOR_HOST',
]);
upsert(join(ROOT, 'apps/mobile/.env'), {
  EXPO_PUBLIC_API_URL: `http://${host}:8080/v1`,
  EXPO_PUBLIC_LEGAL_BASE_URL: `http://${host}:4321`,
  EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: `${host}:9099`,
  EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST: `${host}:8085`,
});

log(`Hosts locales apuntando a ${host}.`);
log(
  'Reinicia el almacenamiento (pnpm infra:up) y la app (pnpm dev) para que tomen los valores nuevos.',
);
