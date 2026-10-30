import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  type QuerySnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  FIRESTORE_PROJECT_ID,
  firestoreAvailable,
  firestoreEndpoint,
} from '../firestore-emulator.js';

const RULES = resolve(import.meta.dirname, '../../../../firebase/firestore.rules');
const CHAT_ID = 'chat-1';
const ANA = 'uid-ana';
const LUIS = 'uid-luis';
const INTRUSO = 'uid-intruso';
const REALTIME_TIMEOUT_MS = 5000;

let env: RulesTestEnvironment;

/** Siembra el chat como lo haría la API (con `firebase-admin`, que no pasa por las reglas). */
async function seedChat(): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'chats', CHAT_ID), {
      matchId: 'match-1',
      participantUids: [ANA, LUIS],
      createdAt: new Date('2026-10-20T09:00:00.000Z'),
    });
    await setDoc(doc(db, 'chats', CHAT_ID, 'messages', 'm-1'), {
      kind: 'text',
      senderId: 'user-ana',
      senderName: 'Ana',
      text: 'Hola',
      createdAt: new Date('2026-10-20T09:01:00.000Z'),
    });
  });
}

describe.skipIf(!firestoreAvailable())(
  'reglas de Firestore del chat (firebase/firestore.rules)',
  () => {
    beforeAll(async () => {
      env = await initializeTestEnvironment({
        projectId: FIRESTORE_PROJECT_ID,
        firestore: { ...firestoreEndpoint(), rules: readFileSync(RULES, 'utf8') },
      });
    });

    beforeEach(async () => {
      await env.clearFirestore();
      await seedChat();
    });

    afterAll(async () => {
      await env.cleanup();
    });

    const messages = (uid: string | null) => {
      const context = uid === null ? env.unauthenticatedContext() : env.authenticatedContext(uid);
      return collection(context.firestore(), 'chats', CHAT_ID, 'messages');
    };

    describe('lectura', () => {
      it('un participante lee los mensajes de su chat', async () => {
        const snapshot = await assertSucceeds<QuerySnapshot>(
          getDocs(query(messages(ANA), orderBy('createdAt'))),
        );

        expect(snapshot.docs.map((message) => String(message.data()['text']))).toEqual(['Hola']);
      });

      it('todos los participantes del match leen, también el segundo', async () => {
        await expect(assertSucceeds(getDocs(messages(LUIS)))).resolves.toBeDefined();
      });

      it('un participante lee el documento de su chat', async () => {
        const context = env.authenticatedContext(ANA);

        await expect(
          assertSucceeds(getDoc(doc(context.firestore(), 'chats', CHAT_ID))),
        ).resolves.toBeDefined();
      });

      it('Scenario: Usuario ajeno - quien no participa no puede leer los mensajes ni el chat', async () => {
        const context = env.authenticatedContext(INTRUSO);

        await expect(assertFails(getDocs(messages(INTRUSO)))).resolves.toBeDefined();
        await expect(assertFails(getDoc(doc(messages(INTRUSO), 'm-1')))).resolves.toBeDefined();
        await expect(
          assertFails(getDoc(doc(context.firestore(), 'chats', CHAT_ID))),
        ).resolves.toBeDefined();
      });

      it('Scenario: Usuario ajeno - sin sesión tampoco se lee', async () => {
        await expect(assertFails(getDocs(messages(null)))).resolves.toBeDefined();
      });

      it('un chat que no existe no se lee', async () => {
        const context = env.authenticatedContext(ANA);

        await expect(
          assertFails(getDocs(collection(context.firestore(), 'chats', 'otro', 'messages'))),
        ).resolves.toBeDefined();
      });

      it('Scenario: Mensaje en tiempo real - el listener de un participante recibe el mensaje que escribe la API', async () => {
        const received: string[] = [];
        let notify: () => void = () => undefined;
        const arrived = new Promise<void>((done) => {
          notify = done;
        });
        const stop = onSnapshot(query(messages(LUIS), orderBy('createdAt')), (snapshot) => {
          received.splice(
            0,
            received.length,
            ...snapshot.docs.map((message) => String(message.data()['text'])),
          );
          if (received.includes('¿Te viene bien visitarla el sábado?')) notify();
        });

        await env.withSecurityRulesDisabled(async (context) => {
          await setDoc(doc(context.firestore(), 'chats', CHAT_ID, 'messages', 'm-2'), {
            kind: 'text',
            senderId: 'user-ana',
            senderName: 'Ana',
            text: '¿Te viene bien visitarla el sábado?',
            createdAt: new Date('2026-10-20T09:02:00.000Z'),
          });
        });
        await Promise.race([
          arrived,
          new Promise((_, fail) =>
            setTimeout(() => {
              fail(new Error('El listener no recibió el mensaje a tiempo'));
            }, REALTIME_TIMEOUT_MS),
          ),
        ]);
        stop();

        expect(received).toEqual(['Hola', '¿Te viene bien visitarla el sábado?']);
      });
    });

    describe('escritura', () => {
      it('Scenario: Escritura directa - un participante no puede crear un mensaje', async () => {
        await expect(
          assertFails(
            addDoc(messages(ANA), {
              kind: 'text',
              senderId: 'user-ana',
              senderName: 'Ana',
              text: 'Colado',
              createdAt: new Date(),
            }),
          ),
        ).resolves.toBeDefined();
        await expect(
          assertFails(setDoc(doc(messages(ANA), 'm-3'), { kind: 'text', text: 'Colado' })),
        ).resolves.toBeDefined();
      });

      it('Scenario: Escritura directa - un participante no puede editar ni borrar un mensaje', async () => {
        await expect(
          assertFails(updateDoc(doc(messages(ANA), 'm-1'), { text: 'Editado' })),
        ).resolves.toBeDefined();
        await expect(assertFails(deleteDoc(doc(messages(ANA), 'm-1')))).resolves.toBeDefined();
      });

      it('Scenario: Escritura directa - un participante no puede reescribir ni borrar el documento del chat', async () => {
        const db = env.authenticatedContext(ANA).firestore();

        await expect(
          assertFails(updateDoc(doc(db, 'chats', CHAT_ID), { participantUids: [ANA] })),
        ).resolves.toBeDefined();
        await expect(assertFails(deleteDoc(doc(db, 'chats', CHAT_ID)))).resolves.toBeDefined();
      });

      it('un ajeno no puede crear un chat en el que figure como participante ni añadirse a uno', async () => {
        const db = env.authenticatedContext(INTRUSO).firestore();

        await expect(
          assertFails(setDoc(doc(db, 'chats', 'propio'), { participantUids: [INTRUSO] })),
        ).resolves.toBeDefined();
        await expect(
          assertFails(updateDoc(doc(db, 'chats', CHAT_ID), { participantUids: [ANA, INTRUSO] })),
        ).resolves.toBeDefined();
      });
    });

    it('cualquier otra colección sigue en denegación total', async () => {
      const db = env.authenticatedContext(ANA).firestore();

      await expect(assertFails(getDoc(doc(db, 'users', ANA)))).resolves.toBeDefined();
      await expect(
        assertFails(setDoc(doc(db, 'users', ANA), { admin: true })),
      ).resolves.toBeDefined();
    });
  },
);
