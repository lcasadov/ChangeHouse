import type { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';

import { FirestoreChatChannel } from './firestore-chat-channel.js';

const AT = new Date('2026-10-29T18:30:00.000Z');

interface FakeDocument {
  id: string;
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

/** Firestore falso: `getAll` devuelve los documentos de la lista en el orden de las referencias. */
function fakeFirestore(documents: Record<string, FakeDocument>) {
  const requested: string[] = [];
  const firestore = {
    collection: (name: string) => ({
      doc: (chatId: string) => ({
        collection: (sub: string) => ({
          doc: (id: string) => ({ path: `${name}/${chatId}/${sub}/${id}`, id }),
        }),
      }),
    }),
    getAll: (...references: { path: string }[]) => {
      requested.push(...references.map((reference) => reference.path));
      return Promise.resolve(
        references.map(
          (reference) =>
            documents[reference.path] ?? { id: '', exists: false, data: () => undefined },
        ),
      );
    },
  } as unknown as Firestore;
  return { channel: new FirestoreChatChannel(firestore), requested };
}

const stored = (id: string, data: Record<string, unknown>): FakeDocument => ({
  id,
  exists: true,
  data: () => ({ senderId: 'beto', senderName: 'Beto', createdAt: { toDate: () => AT }, ...data }),
});

describe('FirestoreChatChannel.findMessage', () => {
  it('sin chats no consulta nada', async () => {
    const { channel, requested } = fakeFirestore({});

    expect(await channel.findMessage([], 'm1')).toBeNull();
    expect(requested).toEqual([]);
  });

  it('devuelve el mensaje de texto del chat en el que está', async () => {
    const { channel, requested } = fakeFirestore({
      'chats/b/messages/m1': stored('m1', { kind: 'text', text: 'Hola' }),
    });

    const found = await channel.findMessage(['a', 'b'], 'm1');

    expect(requested).toEqual(['chats/a/messages/m1', 'chats/b/messages/m1']);
    expect(found).toEqual({
      chatId: 'b',
      message: {
        id: 'm1',
        kind: 'text',
        senderId: 'beto',
        senderName: 'Beto',
        text: 'Hola',
        createdAt: AT,
      },
    });
  });

  it('devuelve el mensaje de imagen', async () => {
    const { channel } = fakeFirestore({
      'chats/a/messages/m1': stored('m1', { kind: 'image', imageId: 'foto' }),
    });

    expect((await channel.findMessage(['a'], 'm1'))?.message).toMatchObject({
      kind: 'image',
      imageId: 'foto',
    });
  });

  it.each([
    ['uno del sistema', { kind: 'system' }],
    ['un texto sin texto', { kind: 'text' }],
    ['una imagen sin imagen', { kind: 'image' }],
    ['sin remitente', { kind: 'text', text: 'x', senderId: 3 }],
    ['sin nombre', { kind: 'text', text: 'x', senderName: undefined }],
    ['sin fecha', { kind: 'text', text: 'x', createdAt: undefined }],
  ])('no devuelve %s', async (_label, data) => {
    const { channel } = fakeFirestore({ 'chats/a/messages/m1': stored('m1', data) });

    expect(await channel.findMessage(['a'], 'm1')).toBeNull();
  });

  it('un documento inexistente en todos los chats es null', async () => {
    const { channel } = fakeFirestore({});

    expect(await channel.findMessage(['a', 'b'], 'm1')).toBeNull();
  });
});
