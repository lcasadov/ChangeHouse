import { defineConfig, devices } from '@playwright/test';

import { API_ENV, API_PORT, APP_PORT } from './e2e/scripts/environment.cjs';

// E2E de la app web contra el entorno local completo, sin GCP (docs/TESTING-STRATEGY.md §1 y §7).
// `pnpm test:e2e` prepara antes la infraestructura y la app exportada (e2e/scripts/prepare.mjs) y
// arranca los emuladores de Auth y Firestore alrededor de `playwright test`.
// Los specs comparten una sola API y una sola base de datos: se ejecutan en serie y cada uno crea
// sus propios usuarios (emails únicos) y aísla sus viviendas por tipo de vivienda.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${String(APP_PORT)}`,
    locale: 'es-ES',
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'api',
      command: 'pnpm --filter @changehouse/api exec tsx src/main.ts',
      cwd: '../..',
      env: API_ENV,
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      name: 'app',
      command: 'node e2e/scripts/static-server.mjs',
      port: APP_PORT,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
