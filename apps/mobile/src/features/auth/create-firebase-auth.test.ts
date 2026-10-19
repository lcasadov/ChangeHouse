import AsyncStorage from '@react-native-async-storage/async-storage';
import * as firebaseApp from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import { Platform } from 'react-native';

import { createFirebaseAuth } from './create-firebase-auth';

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'app' })),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => ({ name: 'app' })),
}));
jest.mock('firebase/auth', () => ({
  initializeAuth: jest.fn(() => ({ name: 'auth' })),
  getAuth: jest.fn(() => ({ name: 'auth-existing' })),
  getReactNativePersistence: jest.fn(() => 'persistencia-nativa'),
  connectAuthEmulator: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn() },
}));

const apps = jest.mocked(firebaseApp);
const auth = jest.mocked(firebaseAuth);

const config = {
  firebase: { apiKey: 'k', authDomain: 'd', projectId: 'demo-changehouse', appId: 'a' },
  emulatorHost: undefined,
};

function withPlatform(os: string, run: () => void) {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
  try {
    run();
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  apps.getApps.mockReturnValue([]);
});

describe('createFirebaseAuth', () => {
  it('en móvil guarda la sesión en AsyncStorage', () => {
    withPlatform('ios', () => {
      createFirebaseAuth(config);
    });

    expect(apps.initializeApp).toHaveBeenCalledWith(config.firebase);
    expect(auth.getReactNativePersistence).toHaveBeenCalledWith(AsyncStorage);
    expect(auth.initializeAuth).toHaveBeenCalledWith(
      { name: 'app' },
      { persistence: 'persistencia-nativa' },
    );
  });

  it('en web usa la persistencia del navegador (IndexedDB con respaldo en localStorage)', () => {
    withPlatform('web', () => {
      expect(createFirebaseAuth(config)).toEqual({ name: 'auth-existing' });
    });

    expect(auth.getReactNativePersistence).not.toHaveBeenCalled();
    expect(auth.initializeAuth).not.toHaveBeenCalled();
    expect(auth.getAuth).toHaveBeenCalledWith({ name: 'app' });
  });

  it('en web también se conecta al emulador si está configurado', () => {
    withPlatform('web', () => {
      createFirebaseAuth({ ...config, emulatorHost: 'localhost:9099' });
    });

    expect(auth.connectAuthEmulator).toHaveBeenCalledWith(
      { name: 'auth-existing' },
      'http://localhost:9099',
      { disableWarnings: true },
    );
  });

  it('con el emulador configurado se conecta a él', () => {
    withPlatform('ios', () => {
      createFirebaseAuth({ ...config, emulatorHost: 'localhost:9099' });
    });

    expect(auth.connectAuthEmulator).toHaveBeenCalledWith(
      { name: 'auth' },
      'http://localhost:9099',
      { disableWarnings: true },
    );
  });

  it('sin emulador no se conecta a ninguno', () => {
    withPlatform('ios', () => {
      createFirebaseAuth(config);
    });

    expect(auth.connectAuthEmulator).not.toHaveBeenCalled();
  });

  it('reutiliza la app y la autenticación si ya existen (recarga en caliente)', () => {
    apps.getApps.mockReturnValue([{ name: 'app' } as never]);

    withPlatform('ios', () => {
      expect(createFirebaseAuth(config)).toEqual({ name: 'auth-existing' });
    });

    expect(apps.initializeApp).not.toHaveBeenCalled();
    expect(auth.initializeAuth).not.toHaveBeenCalled();
  });
});
