import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, describe, expect, it } from 'vitest';

import { firestoreAvailable } from '../../../test/firestore-emulator.js';
import { testConfig } from '../../../test/fixtures.js';
import type { NewChat } from '../../application/chat/chat-channel.js';
import { createFirestoreChatChannel } from './firestore-chat-channel.js';

const config = testConfig();
const created = createFirestoreChatChannel(config.firebase);
const inspector = initializeApp({ projectId: config.firebase.projectId }, 'channel-inspector');
const firestore = getFirestore(inspector);
/** Cualquier valor: la marca de tiempo de Firestore no se compara por igualdad. */
const anything: unknown = expect.anything();
const AT = new Date('2026-10-20T09:00:00.000Z');

function chat(chatId: string): NewChat {
  return {
    chatId,
    matchId: chatId,
    participantUids: ['uid-ana', 'uid-beto'],
    createdAt: AT,
    welcome: {
      id: 'welcome',
      kind: 'system',
      event: 'welcome',
      participantNames: ['Ana', 'Beto'],
      createdAt: AT,
    },
  };
}

const messages = async (chatId: string) =>
  (await firestore.collection('chats').doc(chatId).collection('messages').get()).docs;

afterAll(async () => {
  await created.close();
  await deleteApp(inspector);
});

describe.skipIf(!firestoreAvailable())(
  'FirestoreChatChannel contra el emulador de Firestore',
  () => {
    it('crea el chat con los uid de los participantes y el mensaje de bienvenida', async () => {
      const id = crypto.randomUUID();

      await created.channel.createChat(chat(id));

      const document = await firestore.collection('chats').doc(id).get();
      expect(document.data()).toEqual({
        matchId: id,
        participantUids: ['uid-ana', 'uid-beto'],
        createdAt: anything,
      });
      const stored = await messages(id);
      expect(stored.map((message) => [message.id, String(message.data()['kind'])])).toEqual([
        ['welcome', 'system'],
      ]);
      expect(stored[0]?.data()).toMatchObject({
        event: 'welcome',
        participantNames: ['Ana', 'Beto'],
      });
    });

    it('crearlo otra vez no hace nada: un solo chat, un solo mensaje de bienvenida y los mensajes se conservan', async () => {
      const id = crypto.randomUUID();
      await created.channel.createChat(chat(id));
      await created.channel.appendMessage(id, {
        id: 'm-1',
        kind: 'text',
        senderId: 'user-ana',
        senderName: 'Ana',
        text: 'Hola',
        createdAt: AT,
      });

      await expect(created.channel.createChat(chat(id))).resolves.toBeUndefined();

      expect((await messages(id)).map((message) => message.id).sort()).toEqual(['m-1', 'welcome']);
    });

    it('guarda un texto y una imagen con el id interno, el nombre y la ruta privada, sin campos de más', async () => {
      const id = crypto.randomUUID();
      await created.channel.createChat(chat(id));

      await created.channel.appendMessage(id, {
        id: 'm-text',
        kind: 'text',
        senderId: 'user-ana',
        senderName: 'Ana',
        text: 'Hola',
        createdAt: AT,
      });
      await created.channel.appendMessage(id, {
        id: 'm-image',
        kind: 'image',
        senderId: 'user-beto',
        senderName: 'Beto',
        imageId: 'm-image',
        createdAt: AT,
      });

      const byId = new Map((await messages(id)).map((message) => [message.id, message.data()]));
      expect(byId.get('m-text')).toEqual({
        kind: 'text',
        senderId: 'user-ana',
        senderName: 'Ana',
        text: 'Hola',
        createdAt: anything,
      });
      expect(byId.get('m-image')).toEqual({
        kind: 'image',
        senderId: 'user-beto',
        senderName: 'Beto',
        imageId: 'm-image',
        createdAt: anything,
      });
    });

    it('escribir en un chat que no existe falla en lugar de crearlo a medias', async () => {
      const id = crypto.randomUUID();

      await expect(
        created.channel.appendMessage(id, {
          id: 'm-1',
          kind: 'text',
          senderId: 'user-ana',
          senderName: 'Ana',
          text: 'Hola',
          createdAt: AT,
        }),
      ).rejects.toThrow();

      expect((await firestore.collection('chats').doc(id).get()).exists).toBe(false);
    });

    describe('anonymizeParticipant', () => {
      const anonymization = {
        senderId: 'user-ana',
        displayName: 'Usuario eliminado',
        participantNames: ['Usuario eliminado', 'Beto'],
      };

      async function chatWithMessages(id: string) {
        await created.channel.createChat(chat(id));
        for (const [messageId, senderId, senderName] of [
          ['m-ana', 'user-ana', 'Ana'],
          ['m-beto', 'user-beto', 'Beto'],
        ] as const) {
          await created.channel.appendMessage(id, {
            id: messageId,
            kind: 'text',
            senderId,
            senderName,
            text: `Hola de ${senderName}`,
            createdAt: AT,
          });
        }
      }

      it('renombra los mensajes del remitente y los nombres del mensaje de bienvenida, y conserva el resto', async () => {
        const id = crypto.randomUUID();
        await chatWithMessages(id);

        await created.channel.anonymizeParticipant(id, anonymization);

        const byId = new Map((await messages(id)).map((message) => [message.id, message.data()]));
        expect(byId.get('m-ana')).toMatchObject({
          senderName: 'Usuario eliminado',
          senderId: 'user-ana',
          text: 'Hola de Ana',
        });
        expect(byId.get('m-beto')).toMatchObject({ senderName: 'Beto' });
        expect(byId.get('welcome')?.['participantNames']).toEqual(['Usuario eliminado', 'Beto']);
      });

      it('es idempotente: repetirlo deja el mismo resultado', async () => {
        const id = crypto.randomUUID();
        await chatWithMessages(id);

        await created.channel.anonymizeParticipant(id, anonymization);
        await created.channel.anonymizeParticipant(id, anonymization);

        const stored = await messages(id);
        expect(stored).toHaveLength(3);
        expect(stored.find((m) => m.id === 'm-ana')?.data()['senderName']).toBe(
          'Usuario eliminado',
        );
      });

      it('un chat que no existe no es un error', async () => {
        await expect(
          created.channel.anonymizeParticipant(crypto.randomUUID(), anonymization),
        ).resolves.toBeUndefined();
      });

      it('procesa más mensajes de los que caben en un lote de Firestore', async () => {
        const id = crypto.randomUUID();
        await created.channel.createChat(chat(id));
        const writer = firestore.batch();
        const many = 450;
        for (let index = 0; index < many; index += 1) {
          writer.create(
            firestore
              .collection('chats')
              .doc(id)
              .collection('messages')
              .doc(`bulk-${String(index)}`),
            {
              kind: 'text',
              senderId: 'user-ana',
              senderName: 'Ana',
              text: 'x',
              createdAt: AT,
            },
          );
        }
        await writer.commit();

        await created.channel.anonymizeParticipant(id, anonymization);

        const renamed = (await messages(id)).filter(
          (message) => message.data()['senderName'] === 'Usuario eliminado',
        );
        expect(renamed).toHaveLength(many);
      });
    });
  },
);
