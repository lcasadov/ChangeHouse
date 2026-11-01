// Servidor estático mínimo para el export web de la app (SPA: toda ruta desconocida sirve index.html).
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

import { cspOf, extendDirective, withOrigins } from '../../../../scripts/hosting-csp.mjs';
import { API_PORT, APP_PORT, DIST_DIR, ROOT_DIR } from './environment.cjs';

// Sirve las mismas cabeceras que Hosting (firebase.json), con los orígenes locales en vez de los del
// entorno: las violaciones de la CSP rompen estos E2E igual que romperían la app desplegada.
const LOCAL = {
  api: `http://localhost:${String(API_PORT)}`,
  emulators: ['http://localhost:9099', 'http://localhost:8085'],
  fakeGcs: 'http://localhost:4443',
};
const firebaseConfig = JSON.parse(readFileSync(join(ROOT_DIR, 'firebase.json'), 'utf8'));
const withApi = withOrigins(cspOf(firebaseConfig, 'app'), 'app', {
  API_ORIGIN: LOCAL.api,
  STORAGE_PUBLIC_ORIGIN: LOCAL.fakeGcs,
});
const CSP = extendDirective(withApi, 'connect-src', LOCAL.emulators);
const SECURITY_HEADERS = Object.fromEntries(
  firebaseConfig.hosting
    .find((site) => site.target === 'app')
    .headers.flatMap((rule) => rule.headers)
    .filter((header) => header.key !== 'Strict-Transport-Security')
    .map((header) => [header.key.toLowerCase(), header.value]),
);
SECURITY_HEADERS['content-security-policy'] = CSP;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

async function fileFor(urlPath) {
  const relative = normalize(decodeURIComponent(urlPath)).replace(/^[/\\]+/, '');
  const candidate = join(DIST_DIR, relative);
  if (!candidate.startsWith(DIST_DIR)) return join(DIST_DIR, 'index.html');
  const info = await stat(candidate).catch(() => null);
  return info?.isFile() ? candidate : join(DIST_DIR, 'index.html');
}

createServer((request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  fileFor(pathname)
    .then(async (file) => {
      const body = await readFile(file);
      response.writeHead(200, {
        ...SECURITY_HEADERS,
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      });
      response.end(body);
    })
    .catch(() => {
      response.writeHead(500);
      response.end();
    });
}).listen(APP_PORT, () => {
  process.stdout.write(`App web en http://localhost:${String(APP_PORT)}\n`);
});
