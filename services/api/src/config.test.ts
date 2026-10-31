import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';

const ADDRESS_KEY = Buffer.alloc(32, 7).toString('base64');
const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  FIREBASE_PROJECT_ID: 'changehouse-des',
  ADDRESS_ENCRYPTION_KEY: ADDRESS_KEY,
  // Obligatorios en Cloud Run; en local tienen valor por defecto
  STORAGE_PRIVATE_BUCKET: 'changehouse-des-photos-private',
  STORAGE_PUBLIC_BUCKET: 'changehouse-des-photos-public',
  APP_PUBLIC_URL: 'https://des.changehouse.app',
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
      likesPerDay: 10,
      firebase: {
        projectId: 'changehouse-des',
        authEmulatorHost: undefined,
        firestoreEmulatorHost: undefined,
      },
      outbox: { intervalSeconds: 30 },
      addressEncryptionKey: ADDRESS_KEY,
      places: { serverKey: undefined },
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

  it('lee el límite diario de me gusta del entorno (LIKES_PER_DAY) y rechaza los valores no válidos', () => {
    expect(loadConfig({ ...base, LIKES_PER_DAY: '25' }).likesPerDay).toBe(25);
    for (const invalid of ['0', '-1', 'diez', '2.5', '']) {
      expect(() => loadConfig({ ...base, LIKES_PER_DAY: invalid })).toThrow(/LIKES_PER_DAY/);
    }
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

  it('APP_PUBLIC_URL: lee la URL pública de la app sin barra final, por defecto la local, y rechaza lo que no es una URL', () => {
    expect(loadConfig({ ...base }).appPublicUrl).toBe('https://des.changehouse.app');
    expect(
      loadConfig({ ...base, APP_PUBLIC_URL: 'https://app.changehouse.app/' }).appPublicUrl,
    ).toBe('https://app.changehouse.app');
    const withoutUrl: Record<string, string> = { ...base };
    delete withoutUrl['APP_PUBLIC_URL'];
    expect(loadConfig(withoutUrl).appPublicUrl).toBe('http://localhost:8081');
    for (const invalid of ['no-es-url', 'ftp://x.test', '']) {
      expect(() => loadConfig({ ...base, APP_PUBLIC_URL: invalid })).toThrow(/APP_PUBLIC_URL/);
    }
  });

  it('APP_PUBLIC_URL es obligatoria en Cloud Run', () => {
    const withoutUrl: Record<string, string> = { ...base };
    delete withoutUrl['APP_PUBLIC_URL'];

    expect(() =>
      loadConfig({ ...withoutUrl, K_SERVICE: 'api', GOOGLE_PLACES_SERVER_KEY: 'k' }),
    ).toThrow(/APP_PUBLIC_URL/);
  });

  it('confía en un salto de proxy en Cloud Run (K_SERVICE) y se puede fijar a mano', () => {
    expect(
      loadConfig({ ...base, K_SERVICE: 'api', GOOGLE_PLACES_SERVER_KEY: 'k' }).trustProxyHops,
    ).toBe(1);
    expect(
      loadConfig({
        ...base,
        K_SERVICE: 'api',
        GOOGLE_PLACES_SERVER_KEY: 'k',
        TRUST_PROXY_HOPS: '2',
      }).trustProxyHops,
    ).toBe(2);
    expect(
      loadConfig({
        ...base,
        TRUST_PROXY_HOPS: '0',
        K_SERVICE: 'api',
        GOOGLE_PLACES_SERVER_KEY: 'k',
      }).trustProxyHops,
    ).toBe(0);
  });

  it('desactiva el logger de la aplicación en pruebas', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'test' }).logger).toBe(false);
  });

  it('exige DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('exige FIREBASE_PROJECT_ID: sin él no se podría verificar ningún token', () => {
    expect(() =>
      loadConfig({ DATABASE_URL: base.DATABASE_URL, ADDRESS_ENCRYPTION_KEY: ADDRESS_KEY }),
    ).toThrow(/FIREBASE_PROJECT_ID/);
  });

  it('exige ADDRESS_ENCRYPTION_KEY: sin ella no se podría cifrar ninguna dirección', () => {
    const withoutKey = {
      DATABASE_URL: base.DATABASE_URL,
      FIREBASE_PROJECT_ID: base.FIREBASE_PROJECT_ID,
    };

    expect(() => loadConfig(withoutKey)).toThrow(/ADDRESS_ENCRYPTION_KEY/);
    expect(() => loadConfig({ ...base, ADDRESS_ENCRYPTION_KEY: '' })).toThrow(
      /ADDRESS_ENCRYPTION_KEY/,
    );
  });

  it('lee la clave de servidor de Google Places; sin ella, en local, se usan los lugares de prueba', () => {
    expect(loadConfig({ ...base, GOOGLE_PLACES_SERVER_KEY: 'clave' }).places).toEqual({
      serverKey: 'clave',
    });
    expect(loadConfig({ ...base, GOOGLE_PLACES_SERVER_KEY: '' }).places).toEqual({
      serverKey: undefined,
    });
  });

  it('se niega a arrancar en Cloud Run sin la clave de Google Places: no se resolverían direcciones reales', () => {
    expect(() => loadConfig({ ...base, K_SERVICE: 'api' })).toThrow(/GOOGLE_PLACES_SERVER_KEY/);
    expect(
      loadConfig({ ...base, K_SERVICE: 'api', GOOGLE_PLACES_SERVER_KEY: 'clave' }).places.serverKey,
    ).toBe('clave');
  });

  it('lee el emulador de Auth del entorno para el desarrollo local', () => {
    const config = loadConfig({ ...base, FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099' });

    expect(config.firebase).toEqual({
      projectId: 'changehouse-des',
      authEmulatorHost: 'localhost:9099',
      firestoreEmulatorHost: undefined,
    });
  });

  it('lee el emulador de Firestore del entorno y se niega a usarlo en Cloud Run', () => {
    const config = loadConfig({ ...base, FIRESTORE_EMULATOR_HOST: 'localhost:8085' });

    expect(config.firebase.firestoreEmulatorHost).toBe('localhost:8085');
    expect(() =>
      loadConfig({
        ...base,
        K_SERVICE: 'api',
        GOOGLE_PLACES_SERVER_KEY: 'k',
        FIRESTORE_EMULATOR_HOST: 'localhost:8085',
      }),
    ).toThrow(/FIRESTORE_EMULATOR_HOST/);
  });

  it('lee el intervalo de reintento del outbox (OUTBOX_INTERVAL_SECONDS) y rechaza los valores no válidos', () => {
    expect(loadConfig({ ...base, OUTBOX_INTERVAL_SECONDS: '5' }).outbox).toEqual({
      intervalSeconds: 5,
    });
    for (const invalid of ['0', '-1', 'rápido', '']) {
      expect(() => loadConfig({ ...base, OUTBOX_INTERVAL_SECONDS: invalid })).toThrow(
        /OUTBOX_INTERVAL_SECONDS/,
      );
    }
  });

  it('se niega a arrancar en Cloud Run con el emulador de Auth: aceptaría tokens sin firma', () => {
    expect(() =>
      loadConfig({
        ...base,
        K_SERVICE: 'api',
        GOOGLE_PLACES_SERVER_KEY: 'k',
        FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
      }),
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

  describe('almacenamiento de fotos', () => {
    const withoutBuckets = Object.fromEntries(
      Object.entries(base).filter(([name]) => !name.startsWith('STORAGE_')),
    );

    it('lee los buckets y construye la URL pública a partir del bucket público', () => {
      expect(loadConfig({ ...base }).storage).toEqual({
        privateBucket: 'changehouse-des-photos-private',
        publicBucket: 'changehouse-des-photos-public',
        publicBaseUrl: 'https://storage.googleapis.com/changehouse-des-photos-public',
        emulatorHost: undefined,
      });
    });

    it('permite servir las fotos desde otra URL (la CDN)', () => {
      const config = loadConfig({
        ...base,
        STORAGE_PUBLIC_BASE_URL: 'https://fotos.changehouse.app/',
      });

      expect(config.storage.publicBaseUrl).toBe('https://fotos.changehouse.app');
      expect(() => loadConfig({ ...base, STORAGE_PUBLIC_BASE_URL: 'no-es-url' })).toThrow(
        /STORAGE_PUBLIC_BASE_URL/,
      );
    });

    it('en local los buckets tienen los nombres de docker-compose y, con emulador, la URL pública apunta a él', () => {
      const config = loadConfig({ ...withoutBuckets, FAKE_GCS_HOST: 'localhost:4443' });

      expect(config.storage).toEqual({
        privateBucket: 'changehouse-photos-private',
        publicBucket: 'changehouse-photos-public',
        publicBaseUrl: 'http://localhost:4443/changehouse-photos-public',
        emulatorHost: 'localhost:4443',
      });
    });

    it('se niega a arrancar en Cloud Run sin los dos buckets: las fotos no tendrían dónde vivir', () => {
      const cloudRun = { ...withoutBuckets, K_SERVICE: 'api', GOOGLE_PLACES_SERVER_KEY: 'k' };

      expect(() => loadConfig(cloudRun)).toThrow(/STORAGE_PRIVATE_BUCKET/);
      expect(() => loadConfig({ ...cloudRun, STORAGE_PRIVATE_BUCKET: 'privado' })).toThrow(
        /STORAGE_PUBLIC_BUCKET/,
      );
    });

    it('se niega a arrancar en Cloud Run con el emulador de Storage: subiría las fotos a un servidor falso', () => {
      expect(() =>
        loadConfig({
          ...base,
          K_SERVICE: 'api',
          GOOGLE_PLACES_SERVER_KEY: 'k',
          FAKE_GCS_HOST: 'localhost:4443',
        }),
      ).toThrow(/FAKE_GCS_HOST/);
    });

    it('se niega a arrancar con STORAGE_EMULATOR_HOST: la biblioteca de Storage la lee por su cuenta sin esquema y rompe las subidas (#379)', () => {
      expect(() => loadConfig({ ...base, STORAGE_EMULATOR_HOST: 'localhost:4443' })).toThrow(
        /STORAGE_EMULATOR_HOST.*FAKE_GCS_HOST/,
      );
    });
  });
});
