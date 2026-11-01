// Servidor estático mínimo para el export web de la app (SPA: toda ruta desconocida sirve index.html).
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

import { APP_PORT, DIST_DIR } from './environment.cjs';

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
