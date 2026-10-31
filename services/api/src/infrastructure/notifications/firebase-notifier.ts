import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

import type { Notifier } from '../../application/notifications/notifier.js';
import { FcmPushNotifier } from './fcm-push-notifier.js';
import { FirebaseUserContactDirectory } from './firebase-user-contact-directory.js';
import { FirestoreMailNotifier } from './firestore-mail-notifier.js';

export interface FirebaseNotifierOptions {
  projectId: string;
  /** `host:puerto` del emulador de Firestore. Solo en local y en las pruebas. */
  firestoreEmulatorHost?: string | undefined;
  /** `host:puerto` del emulador de Auth. Solo en local y en las pruebas. */
  authEmulatorHost?: string | undefined;
}

let instances = 0;

/** Crea los canales de aviso (FCM y correo) y la consulta de contacto con su propia aplicación de Firebase; `close` la libera. */
export function createFirebaseNotifier(options: FirebaseNotifierOptions) {
  // El SDK solo lee el emulador de esta variable de entorno, y lo hace al crear `Firestore`
  if (options.firestoreEmulatorHost) {
    process.env['FIRESTORE_EMULATOR_HOST'] = options.firestoreEmulatorHost;
  }
  if (options.authEmulatorHost) {
    process.env['FIREBASE_AUTH_EMULATOR_HOST'] = options.authEmulatorHost;
  }
  instances += 1;
  const app = initializeApp(
    { projectId: options.projectId },
    `changehouse-notifier-${String(instances)}`,
  );
  const notifier: Notifier = {
    push: new FcmPushNotifier(getMessaging(app)),
    email: new FirestoreMailNotifier(getFirestore(app)),
  };
  return {
    notifier,
    contacts: new FirebaseUserContactDirectory(getAuth(app)),
    close: () => deleteApp(app),
  };
}
