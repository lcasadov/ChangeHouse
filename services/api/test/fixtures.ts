import postgres from 'postgres';
import { inject } from 'vitest';

import type { ApiConfig } from '../src/config.js';
import { PROJECT_ID } from './auth-emulator.js';

/** Almacenamiento de fotos para pruebas: fake-gcs-server de Testcontainers y los buckets de docker-compose. */
export function testStorageConfig(): ApiConfig['storage'] {
  const emulatorHost = inject('storageEmulatorHost');
  return {
    privateBucket: 'changehouse-photos-private',
    publicBucket: 'changehouse-photos-public',
    publicBaseUrl: `http://${emulatorHost}/changehouse-photos-public`,
    emulatorHost,
  };
}

/** Configuración de la API para pruebas: BD de Testcontainers, límite alto salvo que se pida otro. */
export function testConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    port: 0,
    databaseUrl: inject('databaseUrl'),
    landingOrigin: 'https://landing.test',
    appOrigins: ['https://app.test'],
    appPublicUrl: 'https://app.test',
    trustProxyHops: 0,
    waitlistRateLimit: { max: 1000, windowSeconds: 600 },
    likesPerDay: 10,
    launchDate: undefined,
    firebase: {
      projectId: PROJECT_ID,
      authEmulatorHost: inject('authEmulatorHost') || undefined,
      firestoreEmulatorHost: inject('firestoreEmulatorHost') || undefined,
    },
    outbox: { intervalSeconds: 30 },
    // Clave de pruebas: 32 bytes fijos. Sin clave de Places se usan los lugares de prueba.
    addressEncryptionKey: Buffer.alloc(32, 7).toString('base64'),
    places: { serverKey: undefined },
    storage: testStorageConfig(),
    logger: false,
    ...overrides,
  };
}

/** Conexión directa para comprobar el estado real de la base de datos. */
export function openSql(url: string = inject('databaseUrl')) {
  return postgres(url, { max: 2, onnotice: () => undefined });
}
