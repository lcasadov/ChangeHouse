import * as Sentry from '@sentry/node';
import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initSentry, instrumentFastify, MINIMAL_DATA_COLLECTION } from './sentry.js';

vi.mock('@sentry/node', () => ({ init: vi.fn(), setupFastifyErrorHandler: vi.fn() }));

describe('initSentry', () => {
  beforeEach(() => {
    vi.mocked(Sentry.init).mockClear();
  });

  it('no inicializa Sentry sin SENTRY_DSN', () => {
    expect(initSentry({})).toBe(false);
    expect(initSentry({ SENTRY_DSN: '' })).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('inicializa Sentry con el DSN y recolección mínima de datos', () => {
    expect(initSentry({ SENTRY_DSN: 'https://clave@o0.ingest.sentry.io/1' })).toBe(true);
    expect(Sentry.init).toHaveBeenCalledWith({
      dsn: 'https://clave@o0.ingest.sentry.io/1',
      dataCollection: MINIMAL_DATA_COLLECTION,
    });
  });

  it('informa el entorno cuando NODE_ENV está definido', () => {
    initSentry({ SENTRY_DSN: 'https://clave@o0.ingest.sentry.io/1', NODE_ENV: 'production' });

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'production' }),
    );
  });
});

describe('instrumentFastify', () => {
  it('registra el manejador de errores de Sentry en la instancia de Fastify', async () => {
    const app = Fastify({ logger: false });

    instrumentFastify(app);

    expect(Sentry.setupFastifyErrorHandler).toHaveBeenCalledWith(app);
    await app.close();
  });
});
