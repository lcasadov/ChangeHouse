import { and, asc, eq, gt, or, sql } from 'drizzle-orm';

import type {
  ReportListing,
  ReportRepository,
} from '../../../application/moderation/report-repository.js';
import type { Report } from '../../../domain/moderation/report.js';
import type { Executor } from './database.js';
import { reports } from './schema.js';

type ReportRow = typeof reports.$inferSelect;

function toReport(row: ReportRow): Report {
  const { evidenceSenderId, evidenceSentAt } = row;
  return {
    id: row.id,
    reporterId: row.reporterId,
    targetType: row.targetType,
    targetId: row.targetId,
    reason: row.reason,
    status: row.status,
    evidence:
      evidenceSenderId !== null && evidenceSentAt !== null
        ? { text: row.evidenceText, senderId: evidenceSenderId, sentAt: evidenceSentAt }
        : null,
    resolution: row.resolution,
    resolvedBy: row.resolvedBy,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
  };
}

/** Denuncias en PostgreSQL. */
export class DrizzleReportRepository implements ReportRepository {
  constructor(private readonly db: Executor) {}

  async insert(report: Report): Promise<void> {
    await this.db.insert(reports).values({
      id: report.id,
      reporterId: report.reporterId,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      status: report.status,
      evidenceText: report.evidence?.text ?? null,
      evidenceSenderId: report.evidence?.senderId ?? null,
      evidenceSentAt: report.evidence?.sentAt ?? null,
      createdAt: report.createdAt,
    });
  }

  async findByIdForUpdate(id: string): Promise<Report | null> {
    const [row] = await this.db.select().from(reports).where(eq(reports.id, id)).for('update');
    return row ? toReport(row) : null;
  }

  /** Solo la resolución: el objetivo, el motivo y la evidencia no cambian nunca. */
  async save(report: Report): Promise<void> {
    await this.db
      .update(reports)
      .set({
        status: report.status,
        resolution: report.resolution,
        resolvedBy: report.resolvedBy,
        resolvedAt: report.resolvedAt,
      })
      .where(eq(reports.id, report.id));
  }

  async listByStatus(query: ReportListing): Promise<Report[]> {
    const { after } = query;
    const rows = await this.db
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.status, query.status),
          after
            ? or(
                gt(reports.createdAt, after.at),
                and(eq(reports.createdAt, after.at), gt(reports.id, after.id)),
              )
            : sql`true`,
        ),
      )
      .orderBy(asc(reports.createdAt), asc(reports.id))
      .limit(query.limit);
    return rows.map(toReport);
  }
}
