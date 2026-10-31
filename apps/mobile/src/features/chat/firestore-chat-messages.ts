import { getApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  type Firestore,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';

import type { ChatMessage, ChatMessages } from './chat-messages';

/** Variables `EXPO_PUBLIC_*` que lee el chat en tiempo real. */
export interface FirestoreChatEnv {
  /** `host:puerto` del emulador de Firestore (`pnpm emulators`). Solo en desarrollo. */
  EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST?: string | undefined;
}

type Fields = Record<string, unknown>;

const DEFAULT_EMULATOR_HOST = 'localhost';
const DEFAULT_EMULATOR_PORT = '8085';

const isFields = (value: unknown): value is Fields => typeof value === 'object' && value !== null;

/** Firestore guarda las fechas como `Timestamp`; solo se acepta lo que sepa convertirse a `Date`. */
function dateOf(value: unknown): Date | undefined {
  if (!isFields(value)) return undefined;
  const toDate = value['toDate'];
  if (typeof toDate !== 'function') return undefined;
  const date: unknown = (toDate as () => unknown).call(value);
  return date instanceof Date ? date : undefined;
}

const stringOf = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

function systemMessage(id: string, fields: Fields, createdAt: Date): ChatMessage | undefined {
  const names = fields['participantNames'];
  if (fields['event'] !== 'welcome' || !Array.isArray(names)) return undefined;
  const participantNames = names.filter((name): name is string => typeof name === 'string');
  return { id, kind: 'system', event: 'welcome', participantNames, createdAt };
}

function participantMessage(id: string, fields: Fields, createdAt: Date): ChatMessage | undefined {
  const senderId = stringOf(fields['senderId']);
  const senderName = stringOf(fields['senderName']);
  if (senderId === undefined || senderName === undefined) return undefined;
  if (fields['kind'] === 'text') {
    const text = stringOf(fields['text']);
    return text === undefined
      ? undefined
      : { id, kind: 'text', senderId, senderName, text, createdAt };
  }
  const imageId = stringOf(fields['imageId']);
  return imageId === undefined
    ? undefined
    : { id, kind: 'image', senderId, senderName, imageId, createdAt };
}

/** Un documento de `chats/{chatId}/messages` como mensaje; `undefined` si no tiene la forma esperada. */
function messageOf(id: string, data: unknown): ChatMessage | undefined {
  if (!isFields(data)) return undefined;
  const createdAt = dateOf(data['createdAt']);
  if (createdAt === undefined) return undefined;
  switch (data['kind']) {
    case 'system':
      return systemMessage(id, data, createdAt);
    case 'text':
    case 'image':
      return participantMessage(id, data, createdAt);
    default:
      return undefined;
  }
}

function openFirestore(env: Readonly<FirestoreChatEnv>): Firestore {
  const app = getApp();
  try {
    // Detrás de redes que cortan las conexiones largas, el SDK recurre solo al sondeo
    const firestore = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    const emulator = env.EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST;
    if (emulator) {
      const [host = DEFAULT_EMULATOR_HOST, port = DEFAULT_EMULATOR_PORT] = emulator.split(':');
      connectFirestoreEmulator(firestore, host, Number(port));
    }
    return firestore;
  } catch {
    // En la recarga en caliente Firestore ya está inicializado (y conectado al emulador)
    return getFirestore(app);
  }
}

/**
 * Adaptador de `ChatMessages` sobre el SDK web de Firestore: escucha `chats/{chatId}/messages`
 * ordenado por fecha con `onSnapshot`. Firestore se abre al escuchar por primera vez, cuando la
 * autenticación ya existe; las reglas solo dejan leer a los participantes del chat.
 */
export function createFirestoreChatMessages(env: Readonly<FirestoreChatEnv>): ChatMessages {
  let firestore: Firestore | undefined;
  return {
    subscribe(chatId, listener) {
      firestore ??= openFirestore(env);
      const messages = query(
        collection(firestore, 'chats', chatId, 'messages'),
        orderBy('createdAt', 'asc'),
      );
      return onSnapshot(
        messages,
        (snapshot) => {
          const parsed = snapshot.docs
            .map((doc) => messageOf(doc.id, doc.data()))
            .filter((message): message is ChatMessage => message !== undefined);
          listener.onMessages(parsed);
        },
        () => {
          listener.onError();
        },
      );
    },
  };
}
