import { describe, expect, it } from 'vitest';

import { ReportNotOpenError } from './errors.js';
import { openReport, resolveReport } from './report.js';

const NOW = new Date('2026-10-30T10:00:00.000Z');
const LATER = new Date('2026-10-31T09:00:00.000Z');

const open = () =>
  openReport({
    id: 'report-1',
    reporterId: 'ana',
    targetType: 'home',
    targetId: 'home-1',
    reason: 'Anuncio falso',
    evidence: null,
    now: NOW,
  });

describe('openReport', () => {
  it('nace abierta, sin resolución y con la fecha de creación', () => {
    expect(open()).toEqual({
      id: 'report-1',
      reporterId: 'ana',
      targetType: 'home',
      targetId: 'home-1',
      reason: 'Anuncio falso',
      status: 'open',
      evidence: null,
      resolution: null,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: NOW,
    });
  });

  it('conserva la evidencia de un mensaje', () => {
    const evidence = { text: 'Insulto', senderId: 'beto', sentAt: NOW };

    expect(openReport({ ...openInput(), evidence }).evidence).toEqual(evidence);
  });
});

function openInput() {
  return {
    id: 'report-2',
    reporterId: 'ana',
    targetType: 'message' as const,
    targetId: 'msg-1',
    reason: 'Insultos',
    evidence: null,
    now: NOW,
  };
}

describe('resolveReport', () => {
  it.each(['resolved', 'dismissed'] as const)(
    'pasa a %s con la nota, el admin y la fecha',
    (status) => {
      const resolved = resolveReport(open(), { status, resolution: 'Revisada' }, 'admin-1', LATER);

      expect(resolved).toMatchObject({
        status,
        resolution: 'Revisada',
        resolvedBy: 'admin-1',
        resolvedAt: LATER,
      });
    },
  );

  it.each(['resolved', 'dismissed'] as const)(
    'una denuncia %s no se vuelve a resolver',
    (status) => {
      const closed = resolveReport(open(), { status, resolution: 'Hecho' }, 'admin-1', NOW);

      expect(() =>
        resolveReport(closed, { status: 'resolved', resolution: 'Otra vez' }, 'admin-2', LATER),
      ).toThrow(ReportNotOpenError);
    },
  );
});
