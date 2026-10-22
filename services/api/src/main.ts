import { initSentry, instrumentFastify } from './infrastructure/observability/sentry.js';
import { buildApp } from './interfaces/http/app.js';

const DEFAULT_PORT = 8080;

// Sentry se inicializa antes de crear la app para capturar también los fallos de arranque
const sentryEnabled = initSentry();
const app = buildApp();
if (sentryEnabled) instrumentFastify(app);
const port = Number(process.env['PORT'] ?? DEFAULT_PORT);

try {
  // Cloud Run exige escuchar en todas las interfaces
  await app.listen({ port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
