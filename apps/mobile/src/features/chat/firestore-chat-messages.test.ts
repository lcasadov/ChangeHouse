import { getApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';

import type { ChatMessage } from './chat-messages';
import { createFirestoreChatMessages } from './firestore-chat-messages';

jest.mock('firebase/app', () => ({ getApp: jest.fn(() => ({ name: 'app' })) }));
jest.mock('firebase/firestore', () => ({
  initializeFirestore: jest.fn(() => ({ kind: 'db' })),
  getFirestore: jest.fn(() => ({ kind: 'existing-db' })),
  connectFirestoreEmulator: jest.fn(),
  collection: jest.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  orderBy: jest.fn((field: string, direction: string) => ({ field, direction })),
  query: jest.fn((source: unknown, ...constraints: unknown[]) => ({ source, constraints })),
  onSnapshot: jest.fn(),
}));

type SnapshotHandler = (snapshot: { docs: { id: string; data: () => unknown }[] }) => void;
type ErrorHandler = (error: Error) => void;

const unsubscribe = jest.fn();
let emit: SnapshotHandler = () => undefined;
let fail: ErrorHandler = () => undefined;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(onSnapshot).mockImplementation(((
    _query: unknown,
    onNext: SnapshotHandler,
    onError: ErrorHandler,
  ) => {
    emit = onNext;
    fail = onError;
    return unsubscribe;
  }) as never);
});

const timestamp = (iso: string) => ({ toDate: () => new Date(iso) });
const doc = (id: string, data: unknown) => ({ id, data: () => data });

function listen(env: Parameters<typeof createFirestoreChatMessages>[0] = {}) {
  const onMessages = jest.fn<void, [ChatMessage[]]>();
  const onError = jest.fn();
  const stop = createFirestoreChatMessages(env).subscribe('chat-1', { onMessages, onError });
  return { onMessages, onError, stop };
}

describe('createFirestoreChatMessages', () => {
  it('no toca Firestore hasta que alguien escucha', () => {
    createFirestoreChatMessages({});

    expect(initializeFirestore).not.toHaveBeenCalled();
  });

  it('escucha chats/{chatId}/messages ordenado por fecha, del más antiguo al más reciente', () => {
    listen();

    expect(collection).toHaveBeenCalledWith({ kind: 'db' }, 'chats', 'chat-1', 'messages');
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'asc');
    expect(query).toHaveBeenCalledTimes(1);
    expect(initializeFirestore).toHaveBeenCalledWith(
      { name: 'app' },
      { experimentalAutoDetectLongPolling: true },
    );
    expect(getApp).toHaveBeenCalled();
  });

  it('traduce los documentos de texto, imagen y sistema', () => {
    const { onMessages } = listen();

    emit({
      docs: [
        doc('welcome', {
          kind: 'system',
          event: 'welcome',
          participantNames: ['Ana', 'Beto'],
          createdAt: timestamp('2026-10-19T10:00:00Z'),
        }),
        doc('m-1', {
          kind: 'text',
          senderId: 'u-1',
          senderName: 'Beto',
          text: 'Hola',
          createdAt: timestamp('2026-10-19T10:01:00Z'),
        }),
        doc('m-2', {
          kind: 'image',
          senderId: 'u-2',
          senderName: 'Ana',
          imageId: 'img-9',
          createdAt: timestamp('2026-10-19T10:02:00Z'),
        }),
      ],
    });

    expect(onMessages).toHaveBeenCalledWith([
      {
        id: 'welcome',
        kind: 'system',
        event: 'welcome',
        participantNames: ['Ana', 'Beto'],
        createdAt: new Date('2026-10-19T10:00:00Z'),
      },
      {
        id: 'm-1',
        kind: 'text',
        senderId: 'u-1',
        senderName: 'Beto',
        text: 'Hola',
        createdAt: new Date('2026-10-19T10:01:00Z'),
      },
      {
        id: 'm-2',
        kind: 'image',
        senderId: 'u-2',
        senderName: 'Ana',
        imageId: 'img-9',
        createdAt: new Date('2026-10-19T10:02:00Z'),
      },
    ]);
  });

  it('descarta los documentos que no tienen la forma esperada en lugar de romper el chat', () => {
    const { onMessages } = listen();

    emit({
      docs: [
        doc('x-1', { kind: 'video', createdAt: timestamp('2026-10-19T10:00:00Z') }),
        doc('x-2', { kind: 'text', senderId: 'u-1', senderName: 'Beto', text: 'sin fecha' }),
        doc('x-3', { kind: 'text', senderId: 'u-1', senderName: 'Beto', createdAt: new Date() }),
        doc('x-4', null),
        doc('ok', {
          kind: 'text',
          senderId: 'u-1',
          senderName: 'Beto',
          text: 'Hola',
          createdAt: timestamp('2026-10-19T10:01:00Z'),
        }),
      ],
    });

    expect(onMessages.mock.calls[0]?.[0].map((message) => message.id)).toEqual(['ok']);
  });

  it('avisa del error del canal', () => {
    const { onError } = listen();

    fail(new Error('permission-denied'));

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('deja de escuchar al cancelar la suscripción', () => {
    const { stop } = listen();

    stop();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('inicializa Firestore una sola vez aunque haya varias suscripciones', () => {
    const chat = createFirestoreChatMessages({});
    const listener = { onMessages: jest.fn(), onError: jest.fn() };

    chat.subscribe('chat-1', listener);
    chat.subscribe('chat-2', listener);

    expect(initializeFirestore).toHaveBeenCalledTimes(1);
  });

  it('se conecta al emulador cuando hay host configurado', () => {
    listen({ EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST: 'localhost:8085' });

    expect(connectFirestoreEmulator).toHaveBeenCalledWith({ kind: 'db' }, 'localhost', 8085);
  });

  it('no usa el emulador sin host', () => {
    listen();

    expect(connectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it('reutiliza la instancia existente si Firestore ya estaba inicializado (recarga en caliente)', () => {
    jest.mocked(initializeFirestore).mockImplementationOnce(() => {
      throw new Error('Firestore has already been started');
    });

    listen({ EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST: 'localhost:8085' });

    expect(getFirestore).toHaveBeenCalledWith({ name: 'app' });
    expect(collection).toHaveBeenCalledWith({ kind: 'existing-db' }, 'chats', 'chat-1', 'messages');
    expect(connectFirestoreEmulator).not.toHaveBeenCalled();
  });
});
