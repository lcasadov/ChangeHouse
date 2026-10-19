import { readFirebaseConfig } from './firebase-config';

describe('readFirebaseConfig', () => {
  it('lee la configuración del entorno', () => {
    const config = readFirebaseConfig({
      EXPO_PUBLIC_FIREBASE_API_KEY: 'clave',
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'changehouse-des.firebaseapp.com',
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'changehouse-des',
      EXPO_PUBLIC_FIREBASE_APP_ID: '1:123:web:abc',
    });

    expect(config).toEqual({
      firebase: {
        apiKey: 'clave',
        authDomain: 'changehouse-des.firebaseapp.com',
        projectId: 'changehouse-des',
        appId: '1:123:web:abc',
      },
      emulatorHost: undefined,
    });
  });

  it('en local usa el proyecto demo-changehouse y una clave de relleno con el emulador', () => {
    const config = readFirebaseConfig({
      EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
    });

    expect(config.emulatorHost).toBe('localhost:9099');
    expect(config.firebase).toEqual({ apiKey: 'demo-api-key', projectId: 'demo-changehouse' });
  });

  it('trata las variables vacías como no definidas', () => {
    const config = readFirebaseConfig({
      EXPO_PUBLIC_FIREBASE_API_KEY: '',
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: '',
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: '',
      EXPO_PUBLIC_FIREBASE_APP_ID: '',
      EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
    });

    expect(config.firebase).toEqual({ apiKey: 'demo-api-key', projectId: 'demo-changehouse' });
  });

  it('una dirección de emulador vacía no cuenta como emulador', () => {
    expect(() => readFirebaseConfig({ EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: '' })).toThrow(
      /EXPO_PUBLIC_FIREBASE_API_KEY/,
    );
  });

  it('sin emulador exige la clave de la API: no se arranca a medias', () => {
    expect(() => readFirebaseConfig({})).toThrow(/EXPO_PUBLIC_FIREBASE_API_KEY/);
  });
});
