import { buildApp } from './interfaces/http/app.js';

const DEFAULT_PORT = 8080;

const app = buildApp();
const port = Number(process.env['PORT'] ?? DEFAULT_PORT);

try {
  // Cloud Run exige escuchar en todas las interfaces
  await app.listen({ port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
