import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  connectAuthEmulator,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { Platform } from 'react-native';

import type { FirebaseConfig } from './firebase-config';

/**
 * Inicializa Firebase Auth con la persistencia de cada plataforma: `AsyncStorage` en móvil y, en web,
 * la del navegador (IndexedDB con respaldo en localStorage, que es la que activa `getAuth`). Así la
 * sesión sobrevive a cerrar la app en Expo Go, en las builds y en web.
 */
export function createFirebaseAuth({ firebase, emulatorHost }: Readonly<FirebaseConfig>): Auth {
  // En la recarga en caliente la app y la autenticación ya existen: initializeAuth lanzaría
  if (getApps().length > 0) return getAuth(getApp());

  const app = initializeApp(firebase);
  const auth =
    Platform.OS === 'web'
      ? getAuth(app)
      : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  if (emulatorHost) connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
  return auth;
}
