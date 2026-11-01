import type { ReportInput, ReportResolutionInput, ReportStatus } from '@changehouse/shared';

import { withdrawFromMatch } from '../../domain/matching/match.js';
import { openReport, type Report, resolveReport } from '../../domain/moderation/report.js';
import type { UserRepository } from '../account/user-repository.js';
import type { Clock } from '../clock.js';
import type { HomeRepository } from '../home/home-repository.js';
import type { IdGenerator } from '../id-generator.js';
import { MATCH_CLOSED } from '../outbox/outbox.js';
import type { AuditAction } from './audit-log.js';
import type { BlockScope, BlockUnitOfWork } from './block-repository.js';
import { encodeCursor, type ModerationCursor } from './cursor.js';
import {
  CannotBlockSelfError,
  CannotReportSelfError,
  ReportNotFoundError,
  ReportTargetNotFoundError,
  UserToBlockNotFoundError,
} from './report-errors.js';
import type { ReportRepository } from './report-repository.js';
import type { ChatMemberships, ChatMessageLookup } from './report-sources.js';
import type { UnitOfWork } from './unit-of-work.js';

export interface ReportDeps {
  reports: ReportRepository;
  units: UnitOfWork;
  homes: Pick<HomeRepository, 'findById'>;
  users: Pick<UserRepository, 'findById'>;
  blockUnits: BlockUnitOfWork;
  memberships: ChatMemberships;
  messages: ChatMessageLookup;
  clock: Clock;
  ids: IdGenerator;
}

/** `Report` del contrato; la evidencia solo la llevan las denuncias de un mensaje. */
export interface ReportView {
  id: string;
  targetType: Report['targetType'];
  targetId: string;
  reason: string;
  status: ReportStatus;
  resolution: string | null;
  evidence: { text: string | null; senderId: string; sentAt: string } | null;
  createdAt: string;
}

export interface AdminReportsQuery {
  /** Por defecto, las abiertas. */
  status?: ReportStatus;
  cursor?: ModerationCursor | undefined;
  limit: number;
}

export interface AdminReportsPage {
  items: ReportView[];
  nextCursor: string | null;
}

/** Estados en los que una vivienda ajena aún no la ve nadie más que su dueño y la moderación. */
const NOT_VISIBLE = new Set(['draft', 'in_review']);

function toView(report: Report): ReportView {
  return {
    id: report.id,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    status: report.status,
    resolution: report.resolution,
    evidence: report.evidence && {
      text: report.evidence.text,
      senderId: report.evidence.senderId,
      sentAt: report.evidence.sentAt.toISOString(),
    },
    createdAt: report.createdAt.toISOString(),
  };
}

async function ensureHomeReportable(deps: ReportDeps, reporterId: string, homeId: string) {
  const home = await deps.homes.findById(homeId);
  if (home === null || NOT_VISIBLE.has(home.status)) throw new ReportTargetNotFoundError();
  if (home.ownerId === reporterId) throw new CannotReportSelfError();
}

async function ensureUserReportable(deps: ReportDeps, reporterId: string, userId: string) {
  if (userId === reporterId) throw new CannotReportSelfError();
  const user = await deps.users.findById(userId);
  if (user === null || user.deletedAt !== null) throw new ReportTargetNotFoundError();
}

/** El mensaje, solo si está en un chat del denunciante; su copia es la evidencia. */
async function evidenceOf(deps: ReportDeps, reporterId: string, messageId: string) {
  const chatIds = await deps.memberships.chatIdsOf(reporterId);
  const found = await deps.messages.findMessage(chatIds, messageId);
  if (found === null) throw new ReportTargetNotFoundError();
  const { message } = found;
  if (message.senderId === reporterId) throw new CannotReportSelfError();
  return {
    text: message.kind === 'text' ? message.text : null,
    senderId: message.senderId,
    sentAt: message.createdAt,
  };
}

/** Todas las comprobaciones van antes de guardar nada. */
async function createReport(
  deps: ReportDeps,
  reporterId: string,
  input: ReportInput,
): Promise<ReportView> {
  let evidence = null;
  if (input.targetType === 'home') {
    await ensureHomeReportable(deps, reporterId, input.targetId);
  } else if (input.targetType === 'user') {
    await ensureUserReportable(deps, reporterId, input.targetId);
  } else {
    evidence = await evidenceOf(deps, reporterId, input.targetId);
  }
  const report = openReport({
    id: deps.ids.next(),
    reporterId,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    evidence,
    now: deps.clock.now(),
  });
  await deps.reports.insert(report);
  return toView(report);
}

async function blockUser(deps: ReportDeps, blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) throw new CannotBlockSelfError();
  const user = await deps.users.findById(blockedId);
  if (user === null || user.deletedAt !== null) throw new UserToBlockNotFoundError();
  await deps.blockUnits.run(async (scope) => {
    const now = deps.clock.now();
    await scope.blocks.add(blockerId, blockedId, now);
    await closeSharedMatches(deps, scope, blockerId, blockedId, now);
  });
}

/**
 * Cierra para todos los matches `open` o `confirmed` en los que participan los dos (con ello su chat
 * queda en solo lectura). Quien bloquea queda `withdrawn`, y el aviso del cierre solo nombra a los
 * demás participantes: quien bloquea no recibe nada.
 */
async function closeSharedMatches(
  deps: ReportDeps,
  scope: BlockScope,
  blockerId: string,
  blockedId: string,
  now: Date,
): Promise<void> {
  const shared = (await scope.matches.findActiveForUpdate(blockerId)).filter((match) =>
    match.participants.some((participant) => participant.userId === blockedId),
  );
  for (const match of shared) {
    await scope.matches.saveState(match.id, withdrawFromMatch(match, blockerId));
    await scope.audit.record({
      actorId: blockerId,
      action: 'match.block_close',
      entity: 'match',
      entityId: match.id,
      at: now,
    });
    const recipients = match.participants
      .map((participant) => participant.userId)
      .filter((userId) => userId !== blockerId);
    await scope.outbox.enqueue({
      id: deps.ids.next(),
      type: MATCH_CLOSED,
      aggregateId: match.id,
      payload: { recipients: [...new Set(recipients)].join(',') },
      at: now,
    });
  }
}

async function adminListReports(
  deps: ReportDeps,
  query: AdminReportsQuery,
): Promise<AdminReportsPage> {
  // Una más de las pedidas: si llega, hay otra página
  const found = await deps.reports.listByStatus({
    status: query.status ?? 'open',
    after: query.cursor,
    limit: query.limit + 1,
  });
  const page = found.slice(0, query.limit);
  const last = page.at(-1);
  const nextCursor =
    found.length > query.limit && last ? encodeCursor({ at: last.createdAt, id: last.id }) : null;
  return { items: page.map(toView), nextCursor };
}

/** La decisión y su entrada de auditoría se confirman juntas; la fila se bloquea frente a otro admin. */
async function adminResolveReport(
  deps: ReportDeps,
  adminId: string,
  reportId: string,
  input: ReportResolutionInput,
): Promise<ReportView> {
  const resolved = await deps.units.run(async ({ reports, audit }) => {
    const report = await reports.findByIdForUpdate(reportId);
    if (report === null) throw new ReportNotFoundError();
    const now = deps.clock.now();
    const decided = resolveReport(report, input, adminId, now);
    const action: AuditAction = input.status === 'resolved' ? 'report.resolve' : 'report.dismiss';
    await reports.save(decided);
    await audit.record({ actorId: adminId, action, entity: 'report', entityId: reportId, at: now });
    return decided;
  });
  return toView(resolved);
}

/** Los casos de uso de denuncias y bloqueos con sus dependencias ya inyectadas. */
export function reportOperations(deps: ReportDeps) {
  return {
    createReport: (reporterId: string, input: ReportInput) => createReport(deps, reporterId, input),
    blockUser: (blockerId: string, blockedId: string) => blockUser(deps, blockerId, blockedId),
    adminListReports: (query: AdminReportsQuery) => adminListReports(deps, query),
    adminResolveReport: (adminId: string, reportId: string, input: ReportResolutionInput) =>
      adminResolveReport(deps, adminId, reportId, input),
  };
}
