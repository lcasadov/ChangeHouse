import type { ReportStatus, ReportTargetType } from '@changehouse/shared';

import { ReportNotOpenError } from './errors.js';

/** Copia del mensaje denunciado: el chat puede cambiar, la prueba no. Una imagen no lleva texto. */
export interface ReportEvidence {
  readonly text: string | null;
  readonly senderId: string;
  readonly sentAt: Date;
}

export interface Report {
  readonly id: string;
  readonly reporterId: string;
  readonly targetType: ReportTargetType;
  readonly targetId: string;
  readonly reason: string;
  readonly status: ReportStatus;
  readonly evidence: ReportEvidence | null;
  readonly resolution: string | null;
  readonly resolvedBy: string | null;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
}

export interface NewReport {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  evidence: ReportEvidence | null;
  now: Date;
}

/** Toda denuncia nace abierta. */
export function openReport(input: NewReport): Report {
  return {
    id: input.id,
    reporterId: input.reporterId,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    status: 'open',
    evidence: input.evidence,
    resolution: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: input.now,
  };
}

export interface ReportDecision {
  status: 'resolved' | 'dismissed';
  resolution: string;
}

/** Cierra una denuncia abierta con la nota, el admin y la fecha; una ya cerrada no vuelve a decidirse. */
export function resolveReport(
  report: Report,
  decision: ReportDecision,
  adminId: string,
  now: Date,
): Report {
  if (report.status !== 'open') throw new ReportNotOpenError();
  return {
    ...report,
    status: decision.status,
    resolution: decision.resolution,
    resolvedBy: adminId,
    resolvedAt: now,
  };
}
