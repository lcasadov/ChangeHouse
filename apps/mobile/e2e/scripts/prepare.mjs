// Prepara el entorno local de los E2E de la app web, sin GCP:
//   1. PostgreSQL + PostGIS y fake-gcs (Docker) arrancados;
//   2. base de datos `changehouse_e2e` recreada y migrada (aislada de la de desarrollo);
//   3. app web exportada de forma estática con las variables apuntando a los emuladores.
// Los emuladores de Auth y Firestore los arranca `firebase emulators:exec` (script test:e2e).
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

import {
  API_ENV,
  APP_ENV,
  DATABASE_URL,
  DIST_DIR,
  E2E_DATABASE,
  MOBILE_DIR,
  ROOT_DIR,
} from './environment.cjs';

function run(title, command, { cwd = ROOT_DIR, env = {} } = {}) {
  const started = Date.now();
  process.stdout.write(`> ${title}\n`);
  const result = spawnSync(command, {
    cwd,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    process.stderr.write(`Falló «${title}» (código ${String(result.status)})\n`);
    process.exit(result.status ?? 1);
  }
  process.stdout.write(`  listo en ${((Date.now() - started) / 1000).toFixed(1)} s\n`);
}

const psql = (sql) =>
  `docker compose exec -T db psql -v ON_ERROR_STOP=1 -U changehouse -d postgres -c "${sql}"`;

run('Infraestructura Docker (PostgreSQL + fake-gcs)', 'docker compose up -d --wait');
run(
  'Recrear la base de datos E2E',
  `${psql(`DROP DATABASE IF EXISTS ${E2E_DATABASE} WITH (FORCE)`)} && ${psql(`CREATE DATABASE ${E2E_DATABASE}`)}`,
);
run('Migraciones', 'pnpm --filter @changehouse/api db:migrate', {
  env: { DATABASE_URL, ...API_ENV },
});
rmSync(DIST_DIR, { recursive: true, force: true });
run('Exportar la app web', `pnpm exec expo export --platform web --output-dir "${DIST_DIR}"`, {
  cwd: MOBILE_DIR,
  env: APP_ENV,
});
