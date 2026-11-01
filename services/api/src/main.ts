import { createApi } from './bootstrap.js';
import { loadConfig } from './config.js';
import { initSentry, instrumentFastify } from './infrastructure/observability/sentry.js';

// Sentry se inicializa antes de crear la app para capturar también los fallos de arranque
const sentryEnabled = initSentry();
const config = loadConfig();
const { app, outbox, retention } = createApi(config);
if (sentryEnabled) instrumentFastify(app);

try {
  // Reintenta cada intervalo (y ya ahora, al arrancar) los chats pendientes de crear
  outbox.start();
  // Purga de retención (chats y lista de espera): al arrancar y cada 24 horas, una instancia a la vez
  retention.start();
  // Cloud Run exige escuchar en todas las interfaces
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
