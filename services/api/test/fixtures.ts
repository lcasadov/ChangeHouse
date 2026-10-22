import postgres from 'postgres';
import { inject } from 'vitest';

import type { ApiConfig } from '../src/config.js';

/** Configuración de la API para pruebas: BD de Testcontainers, límite alto salvo que se pida otro. */
export function testConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    port: 0,
    databaseUrl: inject('databaseUrl'),
    landingOrigin: 'https://landing.test',
    trustProxyHops: 0,
    waitlistRateLimit: { max: 1000, windowSeconds: 600 },
    logger: false,
    ...overrides,
  };
}

/** Conexión directa para comprobar el estado real de la base de datos. */
export function openSql(url: string = inject('databaseUrl')) {
  return postgres(url, { max: 2, onnotice: () => undefined });
}
