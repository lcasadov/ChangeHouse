import { describe, expect, it } from 'vitest';

import {
  InMemoryAuditLog,
  InMemoryBlockRepository,
  InMemoryChatMessages,
  InMemoryHomeRepository,
  InMemoryReportRepository,
  InMemoryUnitOfWork,
  InMemoryUserRepository,
  makeUser,
} from '../../../test/fakes.js';
import { type Home, newDraft } from '../../domain/home/home.js';
import { ReportNotOpenError } from '../../domain/moderation/errors.js';
import { openReport } from '../../domain/moderation/report.js';
import { decodeCursor } from './cursor.js';
import {
  CannotBlockSelfError,
  CannotReportSelfError,
  ReportNotFoundError,
  ReportTargetNotFoundError,
  UserToBlockNotFoundError,
} from './report-errors.js';
import { reportOperations } from './report-operations.js';

const NOW = new Date('2026-10-30T10:00:00.000Z');
const SENT_AT = new Date('2026-10-29T18:30:00.000Z');
const ANA = 'user-ana';
const BETO = 'user-beto';
const ADMIN = 'user-admin';
const LOCATION = {
  exact: { lat: 40.4254, lng: -3.7058 },
  areaName: 'Malasaña',
  areaCenter: { lat: 40.4265, lng: -3.7038 },
};

function setup() {
  const homes = new InMemoryHomeRepository();
  const users = new InMemoryUserRepository([
    makeUser({ id: ANA, firebaseUid: 'uid-ana', email: 'ana@example.com' }),
    makeUser({ id: BETO, firebaseUid: 'uid-beto', email: 'beto@example.com', displayName: 'Beto' }),
  ]);
  const reports = new InMemoryReportRepository();
  const blocks = new InMemoryBlockRepository();
  const chat = new InMemoryChatMessages();
  const audit = new InMemoryAuditLog();
  let sequence = 0;
  const operations = reportOperations({
    reports,
    units: new InMemoryUnitOfWork(homes, audit, reports),
    homes,
    users,
    blocks,
    memberships: chat,
    messages: chat,
    clock: { now: () => NOW },
    ids: { next: () => `report-${String(++sequence)}` },
  });
  return { homes, users, reports, blocks, chat, audit, ...operations };
}

type Fixture = ReturnType<typeof setup>;

function seedHome(fixture: Fixture, id: string, ownerId: string, changes: Partial<Home> = {}) {
  const draft = newDraft({
    id,
    ownerId,
    now: new Date('2026-10-01T09:00:00.000Z'),
    type: 'piso',
    address: 'Calle del Pez, 12, 28004 Madrid',
    location: LOCATION,
  });
  fixture.homes.homes.set(id, { ...draft, status: 'published', ...changes });
}

function seedMessage(fixture: Fixture, messageId: string, senderId: string, chatId = 'chat-1') {
  fixture.chat.chatsByUser.set(ANA, [chatId]);
  fixture.chat.messages.set(messageId, {
    chatId,
    message: {
      id: messageId,
      kind: 'text',
      senderId,
      senderName: 'Beto',
      text: 'Eres un estafador',
      createdAt: SENT_AT,
    },
  });
}

function deletedUser(fixture: Fixture): void {
  fixture.users.users.set(
    'user-borrado',
    makeUser({ id: 'user-borrado', deletedAt: new Date('2026-10-02T00:00:00.000Z') }),
  );
}

describe('createReport', () => {
  it('Scenario: Denunciar una vivienda - queda abierta con el motivo y sin evidencia', async () => {
    const fixture = setup();
    seedHome(fixture, 'home-1', BETO);

    const view = await fixture.createReport(ANA, {
      targetType: 'home',
      targetId: 'home-1',
      reason: 'Anuncio falso',
    });

    expect(view).toEqual({
      id: 'report-1',
      targetType: 'home',
      targetId: 'home-1',
      reason: 'Anuncio falso',
      status: 'open',
      resolution: null,
      evidence: null,
      createdAt: NOW.toISOString(),
    });
    expect(fixture.reports.reports.get('report-1')).toMatchObject({
      reporterId: ANA,
      status: 'open',
    });
  });

  it.each(['draft', 'in_review'] as const)(
    'una vivienda en %s no se puede ver, así que no se denuncia (404)',
    async (status) => {
      const fixture = setup();
      seedHome(fixture, 'home-1', BETO, { status });

      await expect(
        fixture.createReport(ANA, { targetType: 'home', targetId: 'home-1', reason: 'x' }),
      ).rejects.toBeInstanceOf(ReportTargetNotFoundError);
    },
  );

  it('una vivienda pausada sí se puede denunciar', async () => {
    const fixture = setup();
    seedHome(fixture, 'home-1', BETO, { status: 'paused' });

    const view = await fixture.createReport(ANA, {
      targetType: 'home',
      targetId: 'home-1',
      reason: 'x',
    });

    expect(view.status).toBe('open');
  });

  it('una vivienda inexistente es un 404 y no guarda nada', async () => {
    const fixture = setup();

    await expect(
      fixture.createReport(ANA, { targetType: 'home', targetId: 'nada', reason: 'x' }),
    ).rejects.toBeInstanceOf(ReportTargetNotFoundError);
    expect(fixture.reports.reports.size).toBe(0);
  });

  it('no se puede denunciar la vivienda propia', async () => {
    const fixture = setup();
    seedHome(fixture, 'home-1', ANA);

    await expect(
      fixture.createReport(ANA, { targetType: 'home', targetId: 'home-1', reason: 'x' }),
    ).rejects.toBeInstanceOf(CannotReportSelfError);
  });

  it('Scenario: Denunciar a un usuario - se guarda abierta', async () => {
    const fixture = setup();

    const view = await fixture.createReport(ANA, {
      targetType: 'user',
      targetId: BETO,
      reason: 'Acoso',
    });

    expect(view).toMatchObject({ targetType: 'user', targetId: BETO, status: 'open' });
  });

  it('un usuario eliminado o inexistente es un 404', async () => {
    const fixture = setup();
    deletedUser(fixture);

    for (const targetId of ['user-borrado', 'user-fantasma']) {
      await expect(
        fixture.createReport(ANA, { targetType: 'user', targetId, reason: 'x' }),
      ).rejects.toBeInstanceOf(ReportTargetNotFoundError);
    }
  });

  it('no se puede denunciar a uno mismo', async () => {
    const fixture = setup();

    await expect(
      fixture.createReport(ANA, { targetType: 'user', targetId: ANA, reason: 'x' }),
    ).rejects.toBeInstanceOf(CannotReportSelfError);
  });

  it('Scenario: Denunciar un mensaje - guarda el texto, el remitente y la fecha como evidencia', async () => {
    const fixture = setup();
    seedMessage(fixture, 'msg-1', BETO);

    const view = await fixture.createReport(ANA, {
      targetType: 'message',
      targetId: 'msg-1',
      reason: 'Insultos',
    });

    expect(view.evidence).toEqual({
      text: 'Eres un estafador',
      senderId: BETO,
      sentAt: SENT_AT.toISOString(),
    });
    expect(fixture.reports.reports.get('report-1')?.evidence).toEqual({
      text: 'Eres un estafador',
      senderId: BETO,
      sentAt: SENT_AT,
    });
  });

  it('la evidencia de una imagen no lleva texto', async () => {
    const fixture = setup();
    fixture.chat.chatsByUser.set(ANA, ['chat-1']);
    fixture.chat.messages.set('img-1', {
      chatId: 'chat-1',
      message: {
        id: 'img-1',
        kind: 'image',
        senderId: BETO,
        senderName: 'Beto',
        imageId: 'foto',
        createdAt: SENT_AT,
      },
    });

    const view = await fixture.createReport(ANA, {
      targetType: 'message',
      targetId: 'img-1',
      reason: 'Contenido ofensivo',
    });

    expect(view.evidence).toEqual({ text: null, senderId: BETO, sentAt: SENT_AT.toISOString() });
  });

  it('Scenario: Mensaje de un chat ajeno - es un 404 y no guarda nada', async () => {
    const fixture = setup();
    seedMessage(fixture, 'msg-1', BETO, 'chat-ajeno');
    fixture.chat.chatsByUser.set(ANA, ['chat-propio']);

    await expect(
      fixture.createReport(ANA, { targetType: 'message', targetId: 'msg-1', reason: 'x' }),
    ).rejects.toBeInstanceOf(ReportTargetNotFoundError);
    expect(fixture.reports.reports.size).toBe(0);
  });

  it('un mensaje inexistente es un 404', async () => {
    const fixture = setup();

    await expect(
      fixture.createReport(ANA, { targetType: 'message', targetId: 'no-existe', reason: 'x' }),
    ).rejects.toBeInstanceOf(ReportTargetNotFoundError);
  });

  it('no se puede denunciar un mensaje propio', async () => {
    const fixture = setup();
    seedMessage(fixture, 'msg-1', ANA);

    await expect(
      fixture.createReport(ANA, { targetType: 'message', targetId: 'msg-1', reason: 'x' }),
    ).rejects.toBeInstanceOf(CannotReportSelfError);
  });
});

describe('blockUser', () => {
  it('Scenario: Efecto del bloqueo - registra el bloqueo de quien bloquea hacia el bloqueado', async () => {
    const fixture = setup();

    await fixture.blockUser(ANA, BETO);

    expect([...fixture.blocks.blocks]).toEqual([`${ANA}>${BETO}`]);
  });

  it('es idempotente: bloquear de nuevo no falla ni duplica', async () => {
    const fixture = setup();

    await fixture.blockUser(ANA, BETO);
    await fixture.blockUser(ANA, BETO);

    expect(fixture.blocks.blocks.size).toBe(1);
  });

  it('no se puede bloquear a uno mismo', async () => {
    const fixture = setup();

    await expect(fixture.blockUser(ANA, ANA)).rejects.toBeInstanceOf(CannotBlockSelfError);
  });

  it('un usuario inexistente o eliminado es un 404', async () => {
    const fixture = setup();
    deletedUser(fixture);

    for (const userId of ['user-borrado', 'user-fantasma']) {
      await expect(fixture.blockUser(ANA, userId)).rejects.toBeInstanceOf(UserToBlockNotFoundError);
    }
    expect(fixture.blocks.blocks.size).toBe(0);
  });
});

/** Tres denuncias con fechas desordenadas respecto a su inserción. */
async function seedQueue(fixture: Fixture): Promise<void> {
  const base = { reporterId: ANA, targetType: 'message' as const, reason: 'Insultos' };
  const evidence = { text: 'Texto', senderId: BETO, sentAt: SENT_AT };
  const dated = (id: string, targetId: string, day: string) =>
    openReport({ ...base, id, targetId, evidence, now: new Date(`2026-10-${day}T12:00:00.000Z`) });
  await fixture.reports.insert(dated('c', 'm3', '29'));
  await fixture.reports.insert(dated('a', 'm1', '27'));
  await fixture.reports.insert(dated('b', 'm2', '28'));
}

describe('adminListReports', () => {
  it('Scenario: Revisión de denuncias - por defecto las abiertas, de la más antigua a la más reciente, con su evidencia', async () => {
    const fixture = setup();
    await seedQueue(fixture);

    const page = await fixture.adminListReports({ limit: 20 });

    expect(page.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(page.items[0]?.evidence).toEqual({
      text: 'Texto',
      senderId: BETO,
      sentAt: SENT_AT.toISOString(),
    });
    expect(page.nextCursor).toBeNull();
  });

  it('pagina con un cursor que lleva la posición de la última denuncia', async () => {
    const fixture = setup();
    await seedQueue(fixture);

    const first = await fixture.adminListReports({ limit: 2 });
    const cursor = decodeCursor(first.nextCursor ?? '');
    const second = await fixture.adminListReports({ limit: 2, cursor: cursor ?? undefined });

    expect(first.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(cursor).toEqual({ at: new Date('2026-10-28T12:00:00.000Z'), id: 'b' });
    expect(second.items.map((item) => item.id)).toEqual(['c']);
    expect(second.nextCursor).toBeNull();
  });

  it('filtra por estado', async () => {
    const fixture = setup();
    await seedQueue(fixture);
    await fixture.adminResolveReport(ADMIN, 'a', { status: 'dismissed', resolution: 'No procede' });

    const dismissed = await fixture.adminListReports({ status: 'dismissed', limit: 20 });
    const open = await fixture.adminListReports({ limit: 20 });

    expect(dismissed.items.map((item) => item.id)).toEqual(['a']);
    expect(dismissed.items[0]?.resolution).toBe('No procede');
    expect(open.items.map((item) => item.id)).toEqual(['b', 'c']);
  });
});

describe('adminResolveReport', () => {
  it('Scenario: Resolver una denuncia - pasa a resolved con la nota y deja la entrada de auditoría', async () => {
    const fixture = setup();
    await seedQueue(fixture);

    const view = await fixture.adminResolveReport(ADMIN, 'a', {
      status: 'resolved',
      resolution: 'Se avisó al usuario',
    });

    expect(view).toMatchObject({ id: 'a', status: 'resolved', resolution: 'Se avisó al usuario' });
    expect(fixture.reports.reports.get('a')).toMatchObject({
      resolvedBy: ADMIN,
      resolvedAt: NOW,
    });
    expect(fixture.audit.entries).toEqual([
      { actorId: ADMIN, action: 'report.resolve', entity: 'report', entityId: 'a', at: NOW },
    ]);
  });

  it('desestimar audita report.dismiss', async () => {
    const fixture = setup();
    await seedQueue(fixture);

    const view = await fixture.adminResolveReport(ADMIN, 'b', {
      status: 'dismissed',
      resolution: 'Sin pruebas',
    });

    expect(view.status).toBe('dismissed');
    expect(fixture.audit.entries.map((entry) => entry.action)).toEqual(['report.dismiss']);
  });

  it('una denuncia inexistente es un 404', async () => {
    const fixture = setup();

    await expect(
      fixture.adminResolveReport(ADMIN, 'fantasma', { status: 'resolved', resolution: 'x' }),
    ).rejects.toBeInstanceOf(ReportNotFoundError);
  });

  it('una denuncia ya resuelta es un 409 y no deja otra entrada de auditoría', async () => {
    const fixture = setup();
    await seedQueue(fixture);
    await fixture.adminResolveReport(ADMIN, 'a', { status: 'resolved', resolution: 'Hecho' });

    await expect(
      fixture.adminResolveReport(ADMIN, 'a', { status: 'dismissed', resolution: 'Otra' }),
    ).rejects.toBeInstanceOf(ReportNotOpenError);
    expect(fixture.audit.entries).toHaveLength(1);
  });

  it('si la auditoría falla, la denuncia sigue abierta', async () => {
    const fixture = setup();
    await seedQueue(fixture);
    fixture.audit.failWith = new Error('auditoría caída');

    await expect(
      fixture.adminResolveReport(ADMIN, 'a', { status: 'resolved', resolution: 'Hecho' }),
    ).rejects.toThrow('auditoría caída');
    expect(fixture.reports.reports.get('a')?.status).toBe('open');
  });
});
