import type { Home } from '../features/homes/homes-api';
import type { FakeHomes } from './fake-homes';
import { json, problem } from './http-responses';

const MODERATION_PATH = /^\/admin\/homes\/([^/]+)\/moderation$/;
const DEFAULT_LIMIT = 20;
const MAX_REASON = 1000;
const CURSOR_PREFIX = 'cursor-';

const createdOf = (home: Home) => home.createdAt ?? '';

/** La vista de administración: la misma ficha, pero `address` lleva solo el barrio o zona. */
const adminView = (home: Home): Home => ({ ...home, address: home.location.areaName });

/**
 * La administración con las reglas de la API (`adminListHomes`, `adminModerateHome`): cola de la más
 * antigua a la más reciente con paginación por cursor, motivo obligatorio al rechazar y 409 si la
 * vivienda no está en revisión. Ordena por `createdAt`, que es lo que expone el contrato.
 */
export class FakeModeration {
  constructor(private readonly homes: FakeHomes) {}

  respond(path: string, method: string, search: URLSearchParams, body: unknown): Response {
    if (path === '/admin/homes' && method === 'GET') return this.list(search);
    const match = MODERATION_PATH.exec(path);
    if (match && method === 'POST') return this.moderate(match[1] ?? '', body);
    return problem(404);
  }

  private list(search: URLSearchParams): Response {
    const status = search.get('status');
    const matching = this.homes
      .all()
      .filter((home) => status === null || home.status === status)
      .sort((a, b) =>
        status === 'in_review'
          ? createdOf(a).localeCompare(createdOf(b))
          : createdOf(b).localeCompare(createdOf(a)),
      );
    const cursor = search.get('cursor');
    const start = cursor?.startsWith(CURSOR_PREFIX)
      ? Number(cursor.slice(CURSOR_PREFIX.length))
      : 0;
    const limit = Number(search.get('limit') ?? DEFAULT_LIMIT);
    const items = matching.slice(start, start + limit).map(adminView);
    const next = start + limit;
    return json(200, {
      items,
      nextCursor: next < matching.length ? `${CURSOR_PREFIX}${String(next)}` : null,
    });
  }

  private moderate(homeId: string, body: unknown): Response {
    const home = this.homes.all().find((candidate) => candidate.id === homeId);
    if (!home) return problem(404);
    const { decision, reason } = (body ?? {}) as { decision?: string; reason?: string };
    if (decision !== 'approve' && decision !== 'reject') return problem(400);
    const note = reason?.trim() ?? '';
    if (decision === 'reject' && (note === '' || note.length > MAX_REASON)) {
      return problem(400, { errors: [{ field: 'reason', message: 'required' }] });
    }
    if (home.status !== 'in_review') return problem(409);

    home.status = decision === 'approve' ? 'published' : 'draft';
    home.moderationNote = decision === 'approve' ? null : note;
    return json(200, adminView(home));
  }
}
