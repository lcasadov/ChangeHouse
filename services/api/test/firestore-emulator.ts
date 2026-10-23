import { inject } from 'vitest';

export const FIRESTORE_PROJECT_ID = 'demo-changehouse';

/** Falso en local si el emulador de Firestore no está arrancado; en la CI su ausencia rompe la ejecución. */
export function firestoreAvailable(): boolean {
  return inject('firestoreEmulatorHost') !== '';
}

/** `host` y `port` del emulador de Firestore, tal como los pide `@firebase/rules-unit-testing`. */
export function firestoreEndpoint(): { host: string; port: number } {
  const [host = 'localhost', port = '8085'] = inject('firestoreEmulatorHost').split(':');
  return { host, port: Number(port) };
}
