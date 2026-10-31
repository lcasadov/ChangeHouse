import type { components } from '../api/schema';
import { json, problem } from './http-responses';

export type StoredReport = components['schemas']['Report'];

const ADMIN_LIST_PATH = '/admin/reports';
const ADMIN_ITEM_PATH = /^\/admin\/reports\/([^/]+)$/;
const DEFAULT_LIMIT = 20;
const MAX_REASON = 1000;
const MAX_NOTE = 2000;
const CURSOR_PREFIX = 'cursor-';
const TARGET_TYPES = new Set(['user', 'home', 'message']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let sequence = 0;

/** Una denuncia abierta, lista para sembrar la cola del admin. */
export function storedReport(overrides: Partial<StoredReport> = {}): StoredReport {
  sequence += 1;
  return {
    id: `0198f3a0-dddd-7000-8000-${String(sequence).padStart(12, '0')}`,
    targetType: 'home',
    targetId: `0198f3a0-cccc-7000-8000-${String(sequence).padStart(12, '0')}`,
    reason: `Motivo ${String(sequence)}`,
    status: 'open',
    resolution: null,
    createdAt: '2026-10-10T10:00:00.000Z',
    ...overrides,
  };
}

/**
 * Denuncias y bloqueos con las reglas de la API (`createReport`, `blockUser`, `adminListReports`,
 * `adminResolveReport`): motivo de 1 a 1000 caracteres, 404 si el objetivo no existe, 429 al superar
 * el límite, cola de la más antigua a la más reciente y resolución con estado `resolved` o `dismissed`.
 */
export class FakeReports {
  readonly reports: StoredReport[] = [];
  /** Los usuarios a los que se ha bloqueado, en orden. */
  readonly blocked: string[] = [];
  /** Identificadores de objetivo que la API no encuentra (devuelven 404). */
  readonly missing = new Set<string>();
  /** La copia que la API guarda de cada mensaje denunciable, por identificador de mensaje. */
  readonly evidence = new Map<string, NonNullable<StoredReport['evidence']>>();
  /** Las siguientes denuncias se rechazan por superar el límite por hora. */
  rateLimited = false;

  seed(...reports: StoredReport[]): void {
    // Copias: resolver una denuncia no debe alterar el fixture compartido entre pruebas
    this.reports.push(...reports.map((report) => ({ ...report })));
  }

  /** Lo que responde a una persona con sesión: `POST /reports` y `POST /me/blocked-users`. */
  respond(method: string, path: string, body: unknown): Response | null {
    if (method !== 'POST') return null;
    if (path === '/reports') return this.create(body);
    if (path === '/me/blocked-users') return this.block(body);
    return null;
  }

  /** Lo que responde a un admin bajo `/admin/reports`, o `null` si la ruta es de otra cosa. */
  respondAdmin(
    path: string,
    method: string,
    search: URLSearchParams,
    body: unknown,
  ): Response | null {
    if (path === ADMIN_LIST_PATH && method === 'GET') return this.list(search);
    const match = ADMIN_ITEM_PATH.exec(path);
    if (match && method === 'PATCH') return this.resolve(match[1] ?? '', body);
    return null;
  }

  private create(body: unknown): Response {
    const { targetType, targetId, reason } = (body ?? {}) as Record<string, unknown>;
    const text = typeof reason === 'string' ? reason.trim() : '';
    const valid =
      typeof targetType === 'string' &&
      TARGET_TYPES.has(targetType) &&
      typeof targetId === 'string' &&
      targetId !== '' &&
      text !== '' &&
      text.length <= MAX_REASON;
    if (!valid) return problem(400);
    if (this.rateLimited) return problem(429, {}, { 'retry-after': '3600' });
    if (this.missing.has(targetId)) return problem(404);
    const evidence = targetType === 'message' ? this.evidence.get(targetId) : undefined;
    const report = storedReport({
      ...(evidence ? { evidence } : {}),
      targetType: targetType as StoredReport['targetType'],
      targetId,
      reason: text,
      createdAt: new Date().toISOString(),
    });
    this.reports.push(report);
    return json(201, report);
  }

  private block(body: unknown): Response {
    const { userId } = (body ?? {}) as { userId?: unknown };
    if (typeof userId !== 'string' || !UUID.test(userId)) return problem(400);
    if (this.missing.has(userId)) return problem(404);
    if (!this.blocked.includes(userId)) this.blocked.push(userId);
    return new Response(null, { status: 204 });
  }

  private list(search: URLSearchParams): Response {
    const status = search.get('status');
    const matching = this.reports
      .filter((report) => status === null || report.status === status)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const cursor = search.get('cursor');
    const start = cursor?.startsWith(CURSOR_PREFIX)
      ? Number(cursor.slice(CURSOR_PREFIX.length))
      : 0;
    const limit = Number(search.get('limit') ?? DEFAULT_LIMIT);
    const next = start + limit;
    return json(200, {
      items: matching.slice(start, next),
      nextCursor: next < matching.length ? `${CURSOR_PREFIX}${String(next)}` : null,
    });
  }

  private resolve(reportId: string, body: unknown): Response {
    const report = this.reports.find((candidate) => candidate.id === reportId);
    if (!report) return problem(404);
    const { status, resolution } = (body ?? {}) as { status?: unknown; resolution?: unknown };
    const note = typeof resolution === 'string' ? resolution.trim() : '';
    if (
      (status !== 'resolved' && status !== 'dismissed') ||
      note === '' ||
      note.length > MAX_NOTE
    ) {
      return problem(400);
    }
    if (report.status !== 'open') return problem(409);
    report.status = status;
    report.resolution = note;
    return json(200, report);
  }
}
