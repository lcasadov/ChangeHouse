import { describe, expect, it, vi } from 'vitest';

import {
  InMemoryChatChannel,
  InMemoryChatImageStorage,
  InMemoryChatSetup,
  InMemoryMatchReader,
  InMemoryOutbox,
  slidingWindowLimiter,
  StubImageProcessor,
} from '../../../test/fakes.js';
import {
  ChatImageNotFoundError,
  ChatImageRateLimitError,
  ChatNotReadyError,
  ImageNotUploadedError,
} from '../../domain/chat/errors.js';
import { InvalidImageError } from '../../domain/home/errors.js';
import { MatchNotFoundError, MatchNotOpenError } from '../../domain/matching/errors.js';
import type { MatchRecord } from '../matching/matching-repository.js';
import { chatOperations } from './chat-operations.js';
import { chatImagePath, chatUploadPath } from './chat-paths.js';

const MATCH_ID = 'match-1';
const ANA = 'user-ana';
const BETO = 'user-beto';
const NOW = new Date('2026-10-20T09:00:00.000Z');
const MINUTE = 60_000;
const UPLOAD_ID = '0199c1a2-7b3e-7c1d-8a40-3f5e6d7c8b9a';

function match(overrides: Partial<MatchRecord> = {}): MatchRecord {
  const participant = (userId: string, displayName: string, other: string) => ({
    homeId: `home-${userId}`,
    userId,
    displayName,
    givesHomeId: `home-${userId}`,
    receivesHomeId: `home-${other}`,
    compensationCents: 0,
    status: 'pending' as const,
  });
  return {
    id: MATCH_ID,
    type: 2,
    status: 'open',
    createdAt: NOW,
    chatId: MATCH_ID,
    participants: [participant(ANA, 'Ana', BETO), participant(BETO, 'Beto', ANA)],
    ...overrides,
  };
}

const HOUR_MS = 3_600_000;
const UPLOADS_PER_HOUR = 30;

function setup(record: MatchRecord = match(), now: () => Date = () => NOW) {
  const reader = new InMemoryMatchReader([record]);
  const chatSetup = new InMemoryChatSetup();
  chatSetup.rosters.set(MATCH_ID, {
    matchId: MATCH_ID,
    chatId: record.chatId ?? null,
    members: [
      { userId: ANA, firebaseUid: 'uid-ana', displayName: 'Ana' },
      { userId: BETO, firebaseUid: 'uid-beto', displayName: 'Beto' },
    ],
  });
  const channel = new InMemoryChatChannel();
  if (record.chatId) {
    channel.chats.set(record.chatId, {
      chat: {
        chatId: record.chatId,
        matchId: MATCH_ID,
        participantUids: ['uid-ana', 'uid-beto'],
        welcome: {
          id: 'welcome',
          kind: 'system',
          event: 'welcome',
          participantNames: [],
          createdAt: NOW,
        },
        createdAt: NOW,
      },
      messages: [],
    });
  }
  const storage = new InMemoryChatImageStorage();
  const images = new StubImageProcessor();
  const outbox = new InMemoryOutbox();
  const enqueueErrors: unknown[] = [];
  let sequence = 0;
  const operations = chatOperations({
    matches: reader,
    setup: chatSetup,
    channel,
    storage,
    images,
    outbox,
    onEnqueueError: (error) => enqueueErrors.push(error),
    uploadLimiter: slidingWindowLimiter(UPLOADS_PER_HOUR, HOUR_MS),
    clock: { now },
    ids: { next: () => `id-${String(++sequence)}` },
  });
  return { operations, reader, chatSetup, channel, storage, images, outbox, enqueueErrors };
}

describe('createChatForMatch', () => {
  it('Scenario: Chat creado con el match - crea el chat con los uid de Firebase y un mensaje del sistema que presenta a los participantes', async () => {
    const { operations, channel, chatSetup } = setup(match({ chatId: null }));

    await operations.createChatForMatch(MATCH_ID);

    const created = channel.chats.get(MATCH_ID);
    expect(created?.chat).toMatchObject({
      chatId: MATCH_ID,
      matchId: MATCH_ID,
      participantUids: ['uid-ana', 'uid-beto'],
      createdAt: NOW,
    });
    expect(created?.messages).toEqual([
      {
        id: 'welcome',
        kind: 'system',
        event: 'welcome',
        participantNames: ['Ana', 'Beto'],
        createdAt: NOW,
      },
    ]);
    expect((await chatSetup.findRoster(MATCH_ID))?.chatId).toBe(MATCH_ID);
  });

  it('GIVEN un fallo de Firestore WHEN se reintenta THEN el chat acaba creado una sola vez y enlazado', async () => {
    const { operations, channel, chatSetup } = setup(match({ chatId: null }));
    channel.failures = 1;

    await expect(operations.createChatForMatch(MATCH_ID)).rejects.toThrow('Firestore');
    expect((await chatSetup.findRoster(MATCH_ID))?.chatId).toBeNull();
    await operations.createChatForMatch(MATCH_ID);
    await operations.createChatForMatch(MATCH_ID);

    expect(channel.chats.size).toBe(1);
    expect(channel.chats.get(MATCH_ID)?.messages).toHaveLength(1);
    expect(channel.createCalls).toBe(2);
    expect((await chatSetup.findRoster(MATCH_ID))?.chatId).toBe(MATCH_ID);
  });

  it('si el match ya tiene chat no vuelve a escribir en Firestore', async () => {
    const { operations, channel } = setup();

    await operations.createChatForMatch(MATCH_ID);

    expect(channel.createCalls).toBe(0);
  });

  it('un match que ya no existe no es un error: no hay nada que crear', async () => {
    const { operations, channel } = setup();

    await expect(operations.createChatForMatch('otro')).resolves.toBeUndefined();

    expect(channel.createCalls).toBe(0);
  });
});

describe('sendMatchMessage - texto', () => {
  it('un participante envía un texto: se escribe con su id interno y su nombre, y nada más', async () => {
    const { operations, channel } = setup();

    const view = await operations.sendMatchMessage(ANA, MATCH_ID, {
      kind: 'text',
      text: '¿Te viene bien visitarla el sábado?',
    });

    expect(view).toEqual({
      id: 'id-1',
      kind: 'text',
      text: '¿Te viene bien visitarla el sábado?',
      imageUrl: null,
      createdAt: NOW.toISOString(),
    });
    expect(channel.chats.get(MATCH_ID)?.messages).toEqual([
      {
        id: 'id-1',
        kind: 'text',
        senderId: ANA,
        senderName: 'Ana',
        text: '¿Te viene bien visitarla el sábado?',
        createdAt: NOW,
      },
    ]);
  });

  it('Scenario: Usuario ajeno - quien no participa recibe MatchNotFoundError y no se escribe nada', async () => {
    const { operations, channel } = setup();

    await expect(
      operations.sendMatchMessage('user-intruso', MATCH_ID, { kind: 'text', text: 'hola' }),
    ).rejects.toBeInstanceOf(MatchNotFoundError);
    await expect(
      operations.sendMatchMessage(ANA, 'no-existe', { kind: 'text', text: 'hola' }),
    ).rejects.toBeInstanceOf(MatchNotFoundError);

    expect(channel.chats.get(MATCH_ID)?.messages).toEqual([]);
  });

  it('Scenario: Match cerrado - responde MatchNotOpenError y el chat queda solo con su historial', async () => {
    const { operations, channel } = setup(match({ status: 'closed' }));

    const attempt = operations.sendMatchMessage(BETO, MATCH_ID, { kind: 'text', text: 'hola' });

    await expect(attempt).rejects.toBeInstanceOf(MatchNotOpenError);
    await expect(attempt).rejects.toMatchObject({ code: 'MATCH_NOT_OPEN', kind: 'conflict' });
    expect(channel.chats.get(MATCH_ID)?.messages).toEqual([]);
  });

  it('un match confirmado admite mensajes', async () => {
    const { operations } = setup(match({ status: 'confirmed' }));

    await expect(
      operations.sendMatchMessage(ANA, MATCH_ID, { kind: 'text', text: 'hola' }),
    ).resolves.toMatchObject({ kind: 'text' });
  });

  it('si el chat aún no se ha creado responde ChatNotReadyError (409) y no escribe', async () => {
    const { operations, channel } = setup(match({ chatId: null }));

    const attempt = operations.sendMatchMessage(ANA, MATCH_ID, { kind: 'text', text: 'hola' });

    await expect(attempt).rejects.toBeInstanceOf(ChatNotReadyError);
    await expect(attempt).rejects.toMatchObject({ code: 'CHAT_NOT_READY', kind: 'conflict' });
    expect(channel.chats.size).toBe(0);
  });

  it('un fallo de Firestore se propaga como error técnico', async () => {
    const { operations, channel } = setup();
    channel.failures = 1;

    await expect(
      operations.sendMatchMessage(ANA, MATCH_ID, { kind: 'text', text: 'hola' }),
    ).rejects.toThrow('Firestore');
  });
});

describe('sendMatchMessage - aviso en la bandeja de salida', () => {
  it('Scenario: Nuevo mensaje - un texto registra message.sent con el id del mensaje, el match y el remitente, sin el texto', async () => {
    const { operations, outbox } = setup();

    const view = await operations.sendMatchMessage(ANA, MATCH_ID, {
      kind: 'text',
      text: 'Vivo en la calle Mayor 5',
    });

    expect(outbox.events).toEqual([
      {
        id: 'id-2',
        type: 'message.sent',
        aggregateId: view.id,
        payload: { matchId: MATCH_ID, senderId: ANA },
        attempts: 0,
        processedAt: null,
      },
    ]);
    expect(JSON.stringify(outbox.events)).not.toContain('calle Mayor');
  });

  it('una imagen también avisa', async () => {
    const { operations, storage, outbox } = setup();
    storage.originals.set(chatUploadPath(MATCH_ID, ANA, UPLOAD_ID), Buffer.from('IMG:foto'));

    const view = await operations.sendMatchMessage(ANA, MATCH_ID, {
      kind: 'image',
      imageUploadId: UPLOAD_ID,
    });

    expect(outbox.events.map((event) => [event.type, event.aggregateId])).toEqual([
      ['message.sent', view.id],
    ]);
  });

  it('si el mensaje no se publica (match cerrado o Firestore caído) no se avisa de nada', async () => {
    const closed = setup(match({ status: 'closed' }));
    await expect(
      closed.operations.sendMatchMessage(ANA, MATCH_ID, { kind: 'text', text: 'hola' }),
    ).rejects.toBeInstanceOf(MatchNotOpenError);
    const down = setup();
    down.channel.failures = 1;
    await expect(
      down.operations.sendMatchMessage(ANA, MATCH_ID, { kind: 'text', text: 'hola' }),
    ).rejects.toThrow('Firestore');

    expect(closed.outbox.events).toEqual([]);
    expect(down.outbox.events).toEqual([]);
  });
});

describe('sendMatchMessage - fallo al encolar el aviso', () => {
  it('Scenario: Fallo del envío - si falla el registro del aviso el mensaje ya publicado se confirma igualmente y el error se registra', async () => {
    const { operations, outbox, channel, enqueueErrors } = setup();
    vi.spyOn(outbox, 'enqueue').mockRejectedValue(new Error('PostgreSQL no disponible'));

    const view = await operations.sendMatchMessage(ANA, MATCH_ID, { kind: 'text', text: 'hola' });

    expect(view).toMatchObject({ kind: 'text', text: 'hola' });
    expect(channel.chats.get(MATCH_ID)?.messages).toHaveLength(1);
    expect(enqueueErrors).toHaveLength(1);
    expect(String(enqueueErrors[0])).toContain('PostgreSQL');
  });

  it('también con una imagen: se responde con la imagen publicada y se registra el error', async () => {
    const { operations, outbox, storage, enqueueErrors } = setup();
    storage.originals.set(chatUploadPath(MATCH_ID, ANA, UPLOAD_ID), Buffer.from('IMG:foto'));
    vi.spyOn(outbox, 'enqueue').mockRejectedValue(new Error('PostgreSQL no disponible'));

    await expect(
      operations.sendMatchMessage(ANA, MATCH_ID, { kind: 'image', imageUploadId: UPLOAD_ID }),
    ).resolves.toMatchObject({ kind: 'image' });

    expect(enqueueErrors).toHaveLength(1);
  });
});

describe('createChatImageUpload', () => {
  it('emite una URL firmada de 15 minutos para una ruta atada al match y a la cuenta', async () => {
    const { operations, storage } = setup();

    const upload = await operations.createChatImageUpload(ANA, MATCH_ID, 'image/jpeg');

    const expiresAt = new Date(NOW.getTime() + 15 * MINUTE);
    expect(upload).toEqual({
      uploadId: 'id-1',
      uploadUrl: `https://storage.test/upload/${chatUploadPath(MATCH_ID, ANA, 'id-1')}`,
      expiresAt: expiresAt.toISOString(),
    });
    expect(storage.uploadUrls).toEqual([
      { path: chatUploadPath(MATCH_ID, ANA, 'id-1'), contentType: 'image/jpeg', expiresAt },
    ]);
  });

  it('un ajeno recibe 404 y un match cerrado 409, sin emitir ninguna URL', async () => {
    const open = setup();
    await expect(
      open.operations.createChatImageUpload('user-intruso', MATCH_ID, 'image/png'),
    ).rejects.toBeInstanceOf(MatchNotFoundError);
    const closed = setup(match({ status: 'closed' }));
    await expect(
      closed.operations.createChatImageUpload(ANA, MATCH_ID, 'image/png'),
    ).rejects.toBeInstanceOf(MatchNotOpenError);

    expect(open.storage.uploadUrls).toEqual([]);
    expect(closed.storage.uploadUrls).toEqual([]);
  });
});

describe('sendMatchMessage - imagen', () => {
  const upload = (storage: InMemoryChatImageStorage, content = 'IMG:foto', user = ANA) =>
    storage.originals.set(chatUploadPath(MATCH_ID, user, UPLOAD_ID), Buffer.from(content));

  it('Scenario: Imagen - se procesa, se guarda en privado, se anota en el chat y se devuelve con URL firmada de corta duración', async () => {
    const { operations, channel, storage } = setup();
    upload(storage);

    const view = await operations.sendMatchMessage(ANA, MATCH_ID, {
      kind: 'image',
      imageUploadId: UPLOAD_ID,
    });

    const path = chatImagePath(MATCH_ID, 'id-1');
    expect(storage.stored.get(path)).toEqual({
      data: Buffer.from('WEBP:IMG:foto'),
      contentType: 'image/webp',
    });
    expect(storage.originals.size).toBe(0);
    expect(storage.signed).toEqual([{ path, expiresAt: new Date(NOW.getTime() + 15 * MINUTE) }]);
    expect(view).toEqual({
      id: 'id-1',
      kind: 'image',
      text: null,
      imageUrl: `https://storage.test/read/${path}?expires=${new Date(NOW.getTime() + 15 * MINUTE).toISOString()}`,
      createdAt: NOW.toISOString(),
    });
    expect(channel.chats.get(MATCH_ID)?.messages).toEqual([
      {
        id: 'id-1',
        kind: 'image',
        senderId: ANA,
        senderName: 'Ana',
        imageId: 'id-1',
        createdAt: NOW,
      },
    ]);
  });

  it('una imagen que no se ha subido responde ImageNotUploadedError (422) y no escribe', async () => {
    const { operations, channel } = setup();

    const attempt = operations.sendMatchMessage(ANA, MATCH_ID, {
      kind: 'image',
      imageUploadId: UPLOAD_ID,
    });

    await expect(attempt).rejects.toBeInstanceOf(ImageNotUploadedError);
    await expect(attempt).rejects.toMatchObject({ code: 'IMAGE_NOT_UPLOADED' });
    expect(channel.chats.get(MATCH_ID)?.messages).toEqual([]);
  });

  it('el original de otro participante no sirve: la ruta lleva la cuenta de quien envía', async () => {
    const { operations, storage } = setup();
    upload(storage, 'IMG:foto', BETO);

    await expect(
      operations.sendMatchMessage(ANA, MATCH_ID, { kind: 'image', imageUploadId: UPLOAD_ID }),
    ).rejects.toBeInstanceOf(ImageNotUploadedError);
  });

  it('un fichero que no es una imagen responde InvalidImageError y se descarta el original', async () => {
    const { operations, channel, storage } = setup();
    upload(storage, 'esto no es una imagen');

    await expect(
      operations.sendMatchMessage(ANA, MATCH_ID, { kind: 'image', imageUploadId: UPLOAD_ID }),
    ).rejects.toBeInstanceOf(InvalidImageError);

    expect(storage.originals.size).toBe(0);
    expect(storage.stored.size).toBe(0);
    expect(channel.chats.get(MATCH_ID)?.messages).toEqual([]);
  });

  it('un original demasiado grande se descarta como imagen no válida', async () => {
    const { operations, storage } = setup();
    upload(storage, 'IMG:'.padEnd(25 * 1024 * 1024 + 1, 'x'));

    await expect(
      operations.sendMatchMessage(ANA, MATCH_ID, { kind: 'image', imageUploadId: UPLOAD_ID }),
    ).rejects.toBeInstanceOf(InvalidImageError);
    expect(storage.originals.size).toBe(0);
  });

  it('si Firestore falla, la imagen publicada se retira y el original se conserva para reintentar', async () => {
    const { operations, channel, storage } = setup();
    upload(storage);
    channel.failures = 1;

    await expect(
      operations.sendMatchMessage(ANA, MATCH_ID, { kind: 'image', imageUploadId: UPLOAD_ID }),
    ).rejects.toThrow('Firestore');

    expect(storage.stored.size).toBe(0);
    expect(storage.originals.size).toBe(1);
    await expect(
      operations.sendMatchMessage(ANA, MATCH_ID, { kind: 'image', imageUploadId: UPLOAD_ID }),
    ).resolves.toMatchObject({ kind: 'image' });
  });

  it('Scenario: Match cerrado - no se procesa ninguna imagen', async () => {
    const { operations, storage, images } = setup(match({ status: 'closed' }));
    upload(storage);

    await expect(
      operations.sendMatchMessage(ANA, MATCH_ID, { kind: 'image', imageUploadId: UPLOAD_ID }),
    ).rejects.toBeInstanceOf(MatchNotOpenError);

    expect(images.received).toEqual([]);
  });
});

describe('getChatImageUrl', () => {
  const IMAGE_ID = 'imagen-1';
  const stored = (storage: InMemoryChatImageStorage) =>
    storage.stored.set(chatImagePath(MATCH_ID, IMAGE_ID), {
      data: Buffer.from('webp'),
      contentType: 'image/webp',
    });

  it('un participante obtiene una URL firmada de 15 minutos de una imagen del chat', async () => {
    const { operations, storage } = setup();
    stored(storage);

    const result = await operations.getChatImageUrl(BETO, MATCH_ID, IMAGE_ID);

    const expiresAt = new Date(NOW.getTime() + 15 * MINUTE);
    const path = chatImagePath(MATCH_ID, IMAGE_ID);
    expect(result).toEqual({
      url: `https://storage.test/read/${path}?expires=${expiresAt.toISOString()}`,
      expiresAt: expiresAt.toISOString(),
    });
    expect(storage.signed).toEqual([{ path, expiresAt }]);
  });

  it('con el match cerrado el historial sigue siendo legible', async () => {
    const { operations, storage } = setup(match({ status: 'closed' }));
    stored(storage);

    await expect(operations.getChatImageUrl(ANA, MATCH_ID, IMAGE_ID)).resolves.toHaveProperty(
      'url',
    );
  });

  it('Scenario: Usuario ajeno - quien no participa recibe MatchNotFoundError y no se firma nada', async () => {
    const { operations, storage } = setup();
    stored(storage);

    await expect(
      operations.getChatImageUrl('user-intruso', MATCH_ID, IMAGE_ID),
    ).rejects.toBeInstanceOf(MatchNotFoundError);
    await expect(operations.getChatImageUrl(ANA, 'no-existe', IMAGE_ID)).rejects.toBeInstanceOf(
      MatchNotFoundError,
    );
    expect(storage.signed).toEqual([]);
  });

  it('una imagen que no existe en este match es ChatImageNotFoundError (404)', async () => {
    const { operations, storage } = setup();
    storage.stored.set(chatImagePath('otro-match', IMAGE_ID), {
      data: Buffer.from('webp'),
      contentType: 'image/webp',
    });

    const attempt = operations.getChatImageUrl(ANA, MATCH_ID, IMAGE_ID);

    await expect(attempt).rejects.toBeInstanceOf(ChatImageNotFoundError);
    await expect(attempt).rejects.toMatchObject({ kind: 'not_found' });
    expect(storage.signed).toEqual([]);
  });
});

describe('createChatImageUpload: límite por usuario y hora', () => {
  it('Scenario: Demasiadas imágenes en una hora - la subida 31 responde ChatImageRateLimitError (429) con el tiempo de espera', async () => {
    const { operations, storage } = setup();
    for (let index = 0; index < UPLOADS_PER_HOUR; index += 1) {
      await operations.createChatImageUpload(ANA, MATCH_ID, 'image/jpeg');
    }

    const attempt = operations.createChatImageUpload(ANA, MATCH_ID, 'image/jpeg');

    await expect(attempt).rejects.toBeInstanceOf(ChatImageRateLimitError);
    await expect(attempt).rejects.toMatchObject({
      code: 'CHAT_IMAGE_RATE_LIMITED',
      kind: 'rate_limited',
      retryAfterSeconds: 3600,
    });
    expect(storage.uploadUrls).toHaveLength(UPLOADS_PER_HOUR);
  });

  it('el límite es por usuario: Beto no gasta el cupo de Ana', async () => {
    const { operations } = setup();
    for (let index = 0; index < UPLOADS_PER_HOUR; index += 1) {
      await operations.createChatImageUpload(ANA, MATCH_ID, 'image/jpeg');
    }

    await expect(
      operations.createChatImageUpload(BETO, MATCH_ID, 'image/jpeg'),
    ).resolves.toMatchObject({ uploadId: expect.any(String) as string });
  });

  it('pasada la hora el cupo se recupera', async () => {
    let now = NOW;
    const { operations } = setup(match(), () => now);
    for (let index = 0; index < UPLOADS_PER_HOUR; index += 1) {
      await operations.createChatImageUpload(ANA, MATCH_ID, 'image/jpeg');
    }
    now = new Date(NOW.getTime() + HOUR_MS);

    await expect(
      operations.createChatImageUpload(ANA, MATCH_ID, 'image/jpeg'),
    ).resolves.toBeDefined();
  });

  it('una petición rechazada por el match (ajeno o cerrado) no gasta cupo', async () => {
    const { operations } = setup(match({ status: 'closed' }));
    for (let index = 0; index < UPLOADS_PER_HOUR + 5; index += 1) {
      await expect(
        operations.createChatImageUpload(ANA, MATCH_ID, 'image/jpeg'),
      ).rejects.toBeInstanceOf(MatchNotOpenError);
    }
  });
});
