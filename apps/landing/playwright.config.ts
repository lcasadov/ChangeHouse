import { defineConfig, devices } from '@playwright/test';

const PORT = 4399;

// Solo Chromium: la estrategia de pruebas (§7) activa este job en PRs hacia master
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-ES',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `astro build && astro preview --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Guías de prueba publicadas: las reales están en borrador y no se construyen en producción
    env: { GUIAS_CONTENT_DIR: './e2e/guias-content' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
