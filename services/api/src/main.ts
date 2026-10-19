import { createApi } from './bootstrap.js';
import { loadConfig } from './config.js';
import { initSentry, instrumentFastify } from './infrastructure/observability/sentry.js';

// Sentry se inicializa antes de crear la app para capturar también los fallos de arranque
const sentryEnabled = initSentry();
const config = loadConfig();
const { app } = createApi(config);
if (sentryEnabled) instrumentFastify(app);

try {
  // Cloud Run exige escuchar en todas las interfaces
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
