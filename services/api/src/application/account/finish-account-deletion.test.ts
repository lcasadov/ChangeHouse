import { describe, expect, it } from 'vitest';

import {
  InMemoryChatChannel,
  InMemoryChatSetup,
  InMemoryErasureFollowUp,
  InMemoryIdentityRemover,
  InMemoryPhotoStorage,
  InMemoryUserRepository,
  makeUser,
} from '../../../test/fakes.js';
import { finishAccountDeletion } from './finish-account-deletion.js';

const DELETED_AT = new Date('2026-10-30T10:00:00.000Z');

function setup(options: { deleted?: boolean } = {}) {
  const users = new InMemoryUserRepository([
    makeUser({
      id: 'u1',
      firebaseUid: 'uid-1',
      displayName: options.deleted === false ? 'Ana' : 'Usuario eliminado',
      deletedAt: options.deleted === false ? null : DELETED_AT,
    }),
  ]);
  const followUp = new InMemoryErasureFollowUp();
  const storage = new InMemoryPhotoStorage();
  const roster = new InMemoryChatSetup();
  const chat = new InMemoryChatChannel();
  const identity = new InMemoryIdentityRemover();
  return {
    followUp,
    storage,
    roster,
    chat,
    identity,
    run: () => finishAccountDeletion({ users, followUp, storage, roster, chat, identity }, 'u1'),
  };
}

describe('finishAccountDeletion', () => {
  it('Scenario: Eliminación completa - da de baja la cuenta en el proveedor de identidad con su uid', async () => {
    const { run, identity } = setup();

    await run();

    expect(identity.removed).toEqual(['uid-1']);
  });

  it('borra de Cloud Storage las fotos publicadas y los originales pendientes y luego sus filas', async () => {
    const { run, followUp, storage } = setup();
    storage.published.set('homes/h1/p1.webp', {
      data: Buffer.from('x'),
      contentType: 'image/webp',
    });
    storage.originals.set('originals/h1/p1', Buffer.from('x'));
    storage.originals.set('originals/h1/p2', Buffer.from('x'));
    followUp.photos = [
      { homeId: 'h1', photoId: 'p1', status: 'ready', storagePath: 'homes/h1/p1.webp' },
      { homeId: 'h1', photoId: 'p2', status: 'pending', storagePath: 'originals/h1/p2' },
    ];

    await run();

    expect(storage.published.size).toBe(0);
    expect(storage.originals.size).toBe(0);
    expect(followUp.deletedPhotoRecordsOf).toEqual(['u1']);
  });

  it('renombra al remitente en los chats de sus matches y rehace los nombres del mensaje de bienvenida', async () => {
    const { run, followUp, roster, chat } = setup();
    followUp.matchIds = ['m1', 'm2'];
    roster.rosters.set('m1', {
      matchId: 'm1',
      chatId: 'chat-1',
      members: [
        { userId: 'u1', firebaseUid: 'uid-1', displayName: 'Usuario eliminado' },
        { userId: 'u2', firebaseUid: 'uid-2', displayName: 'Beto' },
      ],
    });
    // Sin chat todavía: se crea más tarde con los nombres ya anonimizados
    roster.rosters.set('m2', { matchId: 'm2', chatId: null, members: [] });

    await run();

    expect(chat.anonymized).toEqual([
      {
        chatId: 'chat-1',
        anonymization: {
          senderId: 'u1',
          displayName: 'Usuario eliminado',
          participantNames: ['Usuario eliminado', 'Beto'],
        },
      },
    ]);
  });

  it('un match que ya no existe en el roster se ignora', async () => {
    const { run, followUp, chat, identity } = setup();
    followUp.matchIds = ['fantasma'];

    await run();

    expect(chat.anonymized).toEqual([]);
    expect(identity.removed).toEqual(['uid-1']);
  });

  it('GIVEN un fallo en Firebase Auth WHEN se reintenta THEN termina sin repetir efectos ya hechos', async () => {
    const { run, identity, followUp, roster, chat } = setup();
    followUp.matchIds = ['m1'];
    roster.rosters.set('m1', {
      matchId: 'm1',
      chatId: 'chat-1',
      members: [{ userId: 'u1', firebaseUid: 'uid-1', displayName: 'Usuario eliminado' }],
    });
    identity.failures = 1;

    await expect(run()).rejects.toThrow('Firebase Auth no disponible');
    await run();

    expect(identity.removed).toEqual(['uid-1']);
    // Renombrar es idempotente: repetirlo deja el mismo resultado
    expect(chat.anonymized).toHaveLength(2);
    expect(new Set(chat.anonymized.map((entry) => JSON.stringify(entry))).size).toBe(1);
  });

  it('un fallo de Firestore hace fallar el despacho para reintentarlo y no da de baja antes de tiempo', async () => {
    const { run, followUp, roster, chat, identity } = setup();
    followUp.matchIds = ['m1'];
    roster.rosters.set('m1', {
      matchId: 'm1',
      chatId: 'chat-1',
      members: [{ userId: 'u1', firebaseUid: 'uid-1', displayName: 'Usuario eliminado' }],
    });
    chat.failures = 1;

    await expect(run()).rejects.toThrow('Firestore no disponible');

    expect(identity.removed).toEqual([]);
  });

  it('nunca actúa sobre una cuenta que no está eliminada', async () => {
    const { run, identity, followUp } = setup({ deleted: false });

    await run();

    expect(identity.removed).toEqual([]);
    expect(followUp.deletedPhotoRecordsOf).toEqual([]);
  });
});
