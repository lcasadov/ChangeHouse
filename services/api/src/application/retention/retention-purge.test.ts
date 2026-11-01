import { describe, expect, it } from 'vitest';

import {
  InMemoryAuditLog,
  InMemoryChatChannel,
  InMemoryChatImageStorage,
  InMemoryRetentionUnitOfWork,
} from '../../../test/fakes.js';
import { retentionOperations } from './retention-purge.js';

const NOW = new Date('2026-10-30T10:00:00.000Z');
const MONTH_AGO = (months: number) => {
  const date = new Date(NOW);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date;
};

function setup(options: { launchDate?: Date | undefined } = {}) {
  const audit = new InMemoryAuditLog();
  const units = new InMemoryRetentionUnitOfWork(audit);
  const channel = new InMemoryChatChannel();
  const storage = new InMemoryChatImageStorage();
  const errors: unknown[] = [];
  const operations = retentionOperations({
    units,
    channel,
    storage,
    clock: { now: () => NOW },
    launchDate: options.launchDate,
    onError: (error) => errors.push(error),
  });
  return { audit, units, channel, storage, errors, ...operations };
}

type Env = ReturnType<typeof setup>;

function seedChat(env: Env, matchId: string, closedMonthsAgo: number, closed = true): void {
  env.units.matches.push({
    matchId,
    chatId: matchId,
    status: closed ? 'closed' : 'open',
    closedAt: closed ? MONTH_AGO(closedMonthsAgo) : null,
    chatPurgedAt: null,
  });
  env.channel.chats.set(matchId, {
    chat: {
      chatId: matchId,
      matchId,
      participantUids: [],
      welcome: {
        id: 'welcome',
        kind: 'system',
        event: 'welcome',
        participantNames: [],
        createdAt: NOW,
      },
      createdAt: NOW,
    },
    messages: [
      {
        id: 'm1',
        kind: 'text',
        senderId: 'u',
        senderName: 'U',
        text: 'hola',
        createdAt: NOW,
      },
    ],
  });
  env.storage.stored.set(`chat/${matchId}/m2.webp`, {
    data: Buffer.from('x'),
    contentType: 'image/webp',
  });
}

describe('purga del chat', () => {
  it('Scenario: Chat de un match cerrado hace más de un año - sus mensajes e imágenes se borran, queda marcado y la auditoría lo registra', async () => {
    const env = setup();
    seedChat(env, 'viejo', 13);

    const summary = await env.run();

    expect(summary).toEqual({ ran: true, chats: 1, waitlist: 0 });
    expect(env.channel.chats.get('viejo')?.messages).toEqual([]);
    expect(env.storage.stored.size).toBe(0);
    expect(env.units.matches[0]?.chatPurgedAt).toEqual(NOW);
    expect(env.audit.entries).toEqual([
      {
        actorId: null,
        action: 'retention.purge',
        entity: 'chat',
        entityId: null,
        detail: { count: 1 },
        at: NOW,
      },
    ]);
  });

  it('Scenario: Chat reciente - un match cerrado hace 11 meses conserva su chat y no deja auditoría', async () => {
    const env = setup();
    seedChat(env, 'reciente', 11);

    const summary = await env.run();

    expect(summary.chats).toBe(0);
    expect(env.channel.chats.get('reciente')?.messages).toHaveLength(1);
    expect(env.storage.stored.size).toBe(1);
    expect(env.units.matches[0]?.chatPurgedAt).toBeNull();
    expect(env.audit.entries).toEqual([]);
  });

  it('un match que no está cerrado nunca se purga, por antiguo que sea', async () => {
    const env = setup();
    seedChat(env, 'abierto', 30, false);

    expect((await env.run()).chats).toBe(0);

    expect(env.channel.chats.get('abierto')?.messages).toHaveLength(1);
  });

  it('repetir la purga no vuelve a borrar ni a auditar el chat ya purgado', async () => {
    const env = setup();
    seedChat(env, 'viejo', 13);

    await env.run();
    const again = await env.run();

    expect(again.chats).toBe(0);
    expect(env.audit.entries).toHaveLength(1);
  });

  it('cuenta varios chats en una sola entrada de auditoría', async () => {
    const env = setup();
    seedChat(env, 'a', 14);
    seedChat(env, 'b', 13);
    seedChat(env, 'c', 2);

    await env.run();

    expect(env.audit.entries).toHaveLength(1);
    expect(env.audit.entries[0]?.detail).toEqual({ count: 2 });
  });

  it('un chat que falla se salta, se avisa y se reintenta al día siguiente; los demás se purgan', async () => {
    const env = setup();
    seedChat(env, 'a', 14);
    seedChat(env, 'b', 13);
    env.channel.purgeFailures = 1;

    const first = await env.run();

    expect(first.chats).toBe(1);
    expect(env.errors).toHaveLength(1);
    expect(env.units.matches.map((match) => match.chatPurgedAt !== null)).toEqual([false, true]);
    const second = await env.run();
    expect(second.chats).toBe(1);
    expect(env.units.matches.every((match) => match.chatPurgedAt !== null)).toBe(true);
  });

  it('un match sin chat creado también se marca, solo con sus imágenes por borrar', async () => {
    const env = setup();
    env.units.matches.push({
      matchId: 'sin-chat',
      chatId: null,
      status: 'closed',
      closedAt: MONTH_AGO(13),
      chatPurgedAt: null,
    });

    expect((await env.run()).chats).toBe(1);
  });
});

describe('purga de la lista de espera', () => {
  it('Scenario: Purga tras el plazo - con el lanzamiento hace 13 meses las inscripciones se borran y la auditoría registra cuántas', async () => {
    const env = setup({ launchDate: MONTH_AGO(13) });
    env.units.waitlistRows = 3;

    const summary = await env.run();

    expect(summary).toEqual({ ran: true, chats: 0, waitlist: 3 });
    expect(env.units.waitlistRows).toBe(0);
    expect(env.audit.entries).toEqual([
      {
        actorId: null,
        action: 'retention.purge',
        entity: 'waitlist',
        entityId: null,
        detail: { count: 3 },
        at: NOW,
      },
    ]);
  });

  it('Scenario: Sin fecha de lanzamiento - no se borra ninguna inscripción', async () => {
    const env = setup({ launchDate: undefined });
    env.units.waitlistRows = 3;

    const summary = await env.run();

    expect(summary.waitlist).toBe(0);
    expect(env.units.waitlistRows).toBe(3);
    expect(env.audit.entries).toEqual([]);
  });

  it('con el lanzamiento hace 11 meses todavía se conservan', async () => {
    const env = setup({ launchDate: MONTH_AGO(11) });
    env.units.waitlistRows = 3;

    await env.run();

    expect(env.units.waitlistRows).toBe(3);
  });

  it('sin inscripciones que borrar no deja entrada de auditoría', async () => {
    const env = setup({ launchDate: MONTH_AGO(13) });

    await env.run();

    expect(env.audit.entries).toEqual([]);
  });
});

describe('bloqueo consultivo', () => {
  it('Scenario: Bloqueo consultivo - si otra instancia tiene el bloqueo no hace nada', async () => {
    const env = setup({ launchDate: MONTH_AGO(13) });
    seedChat(env, 'viejo', 13);
    env.units.waitlistRows = 2;
    env.units.locked = true;

    const summary = await env.run();

    expect(summary).toEqual({ ran: false, chats: 0, waitlist: 0 });
    expect(env.channel.chats.get('viejo')?.messages).toHaveLength(1);
    expect(env.units.waitlistRows).toBe(2);
    expect(env.audit.entries).toEqual([]);
  });
});
