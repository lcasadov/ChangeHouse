import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  FIREBASE_PROJECT_ID: 'changehouse-des',
};

describe('loadConfig', () => {
  it('usa los valores por defecto del límite de altas (5 cada 10 minutos)', () => {
    const config = loadConfig({ ...base });

    expect(config).toMatchObject({
      port: 8080,
      databaseUrl: base.DATABASE_URL,
      landingOrigin: 'http://localhost:4321',
      appOrigins: ['http://localhost:8081'],
      trustProxyHops: 0,
      waitlistRateLimit: { max: 5, windowSeconds: 600 },
      firebase: { projectId: 'changehouse-des', authEmulatorHost: undefined },
      logger: true,
    });
  });

  it('lee el límite, la ventana, el puerto y el origen de la landing del entorno', () => {
    const config = loadConfig({
      ...base,
      PORT: '3000',
      LANDING_ORIGIN: 'https://changehouse.app',
      WAITLIST_RATE_LIMIT_MAX: '20',
      WAITLIST_RATE_LIMIT_WINDOW: '60',
    });

    expect(config.port).toBe(3000);
    expect(config.landingOrigin).toBe('https://changehouse.app');
    expect(config.waitlistRateLimit).toEqual({ max: 20, windowSeconds: 60 });
  });

  it('lee los orígenes de la app (lista separada por comas) y rechaza los que no son un origen', () => {
    const config = loadConfig({
      ...base,
      APP_ORIGIN: 'https://app.changehouse.app, https://des.changehouse.app',
    });

    expect(config.appOrigins).toEqual([
      'https://app.changehouse.app',
      'https://des.changehouse.app',
    ]);
    expect(() => loadConfig({ ...base, APP_ORIGIN: 'https://ok.test,no-es-url' })).toThrow(
      /APP_ORIGIN/,
    );
    expect(() => loadConfig({ ...base, APP_ORIGIN: 'https://x.test/ruta' })).toThrow(/APP_ORIGIN/);
  });

  it('confía en un salto de proxy en Cloud Run (K_SERVICE) y se puede fijar a mano', () => {
    expect(loadConfig({ ...base, K_SERVICE: 'api' }).trustProxyHops).toBe(1);
    expect(loadConfig({ ...base, K_SERVICE: 'api', TRUST_PROXY_HOPS: '2' }).trustProxyHops).toBe(2);
    expect(loadConfig({ ...base, TRUST_PROXY_HOPS: '0', K_SERVICE: 'api' }).trustProxyHops).toBe(0);
  });

  it('desactiva el logger de la aplicación en pruebas', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'test' }).logger).toBe(false);
  });

  it('exige DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('exige FIREBASE_PROJECT_ID: sin él no se podría verificar ningún token', () => {
    expect(() => loadConfig({ DATABASE_URL: base.DATABASE_URL })).toThrow(/FIREBASE_PROJECT_ID/);
  });

  it('lee el emulador de Auth del entorno para el desarrollo local', () => {
    const config = loadConfig({ ...base, FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099' });

    expect(config.firebase).toEqual({
      projectId: 'changehouse-des',
      authEmulatorHost: 'localhost:9099',
    });
  });

  it('se niega a arrancar en Cloud Run con el emulador de Auth: aceptaría tokens sin firma', () => {
    expect(() =>
      loadConfig({ ...base, K_SERVICE: 'api', FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099' }),
    ).toThrow(/FIREBASE_AUTH_EMULATOR_HOST/);
  });

  it('rechaza números que no son enteros positivos', () => {
    for (const value of ['0', '-1', 'abc', '1.5', '']) {
      expect(() => loadConfig({ ...base, WAITLIST_RATE_LIMIT_MAX: value })).toThrow(
        /WAITLIST_RATE_LIMIT_MAX/,
      );
    }
    expect(() => loadConfig({ ...base, TRUST_PROXY_HOPS: '-2' })).toThrow(/TRUST_PROXY_HOPS/);
  });

  it('rechaza un origen de la landing que no es un origen', () => {
    expect(() => loadConfig({ ...base, LANDING_ORIGIN: 'no-es-url' })).toThrow(/LANDING_ORIGIN/);
    expect(() => loadConfig({ ...base, LANDING_ORIGIN: 'https://x.test/ruta' })).toThrow(
      /LANDING_ORIGIN/,
    );
  });
});
