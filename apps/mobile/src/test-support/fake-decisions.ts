import type { Home } from '../features/homes/homes-api';
import { json, problem } from './http-responses';

export type DecisionOperation = 'like' | 'dismiss' | 'undo';

/** Una acción registrada: el me gusta o el descarte de `targetHomeId` desde una vivienda (o la cuenta). */
export interface RecordedDecision {
  kind: 'like' | 'dismiss';
  /** La vivienda propia desde la que se decide; `null` para un buscador sin vivienda. */
  fromHomeId: string | null;
  targetHomeId: string;
}

interface Rejection {
  status: number;
  extra: Record<string, unknown>;
  headers: Record<string, string>;
}

interface DecisionBody {
  fromHomeId?: string;
  targetHomeId?: string;
}

const DEFAULT_LIKES_PER_DAY = 10;
const DEFAULT_RETRY_AFTER_SECONDS = 4 * 3600;

/**
 * Los me gusta, descartes y deshacer con las reglas de `likeHome`, `dismissHome` y `undoLastAction`:
 * `owner` para dar me gusta, límite diario con `Retry-After`, repetidos (409), origen ajeno (404) o
 * no publicado (409), y deshacer solo la última acción de esa vivienda (409 si el me gusta es un match).
 * Lo decidido deja de aparecer en el descubrimiento de esa vivienda, como en la API.
 */
export class FakeDecisions {
  /** Las acciones vigentes, de la más antigua a la más reciente. */
  readonly actions: RecordedDecision[] = [];
  /** Los me gusta que ya forman un match (`${fromHomeId}>${targetHomeId}`): no se pueden deshacer. */
  readonly matched = new Set<string>();
  likesPerDay = DEFAULT_LIKES_PER_DAY;
  /** Segundos hasta que vuelve el cupo, en la cabecera `Retry-After` del 429. */
  retryAfterSeconds = DEFAULT_RETRY_AFTER_SECONDS;
  private readonly rejections = new Map<DecisionOperation, Rejection>();

  constructor(
    private readonly roles: () => readonly string[],
    private readonly ownHomes: () => readonly Home[],
    private readonly offered: (homeId: string) => boolean,
  ) {}

  /** La siguiente llamada de esa operación responde con este error. */
  rejectNext(
    operation: DecisionOperation,
    status: number,
    extra: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ): void {
    this.rejections.set(operation, { status, extra, headers });
  }

  /** `true` si ya se decidió sobre esa vivienda desde `viewer` (una vivienda propia o `null`). */
  isDecided(viewer: string | null, targetHomeId: string): boolean {
    return this.actions.some(
      (action) => action.fromHomeId === viewer && action.targetHomeId === targetHomeId,
    );
  }

  likesGiven(): number {
    return this.actions.filter((action) => action.kind === 'like').length;
  }

  respond(method: string, path: string, search: URLSearchParams, body: unknown): Response | null {
    if (method === 'POST' && path === '/me/likes') return this.run('like', () => this.like(body));
    if (method === 'POST' && path === '/me/dismissals') {
      return this.run('dismiss', () => this.dismiss(body));
    }
    if (method === 'DELETE' && path === '/me/last-action') {
      return this.run('undo', () => this.undo(search.get('homeId')));
    }
    return null;
  }

  private run(operation: DecisionOperation, action: () => Response): Response {
    const rejection = this.rejections.get(operation);
    if (rejection) {
      this.rejections.delete(operation);
      return problem(rejection.status, rejection.extra, rejection.headers);
    }
    return action();
  }

  private publishedHome(homeId: string): Home | undefined {
    return this.ownHomes().find((home) => home.id === homeId);
  }

  private like(raw: unknown): Response {
    const { fromHomeId, targetHomeId } = raw as DecisionBody;
    if (!this.roles().includes('owner')) return problem(403);
    const origin = fromHomeId ? this.publishedHome(fromHomeId) : undefined;
    if (!fromHomeId || !origin) return problem(404);
    if (origin.status !== 'published') return problem(409, { code: 'HOME_NOT_PUBLISHED' });
    if (!targetHomeId || !this.offered(targetHomeId)) return problem(404);
    const existing = this.actions.find(
      (action) =>
        action.kind === 'like' &&
        action.fromHomeId === fromHomeId &&
        action.targetHomeId === targetHomeId,
    );
    if (existing) return problem(409, { code: 'LIKE_EXISTS' });
    if (this.likesGiven() >= this.likesPerDay) {
      return problem(
        429,
        { code: 'DAILY_LIKE_LIMIT' },
        { 'retry-after': String(this.retryAfterSeconds) },
      );
    }
    this.record({ kind: 'like', fromHomeId, targetHomeId });
    return json(201, { liked: true, match: null });
  }

  private dismiss(raw: unknown): Response {
    const { fromHomeId, targetHomeId } = raw as DecisionBody;
    const roles = this.roles();
    if (!roles.includes('owner') && !roles.includes('seeker')) return problem(403);
    let origin: string | null = null;
    if (roles.includes('owner')) {
      if (!fromHomeId) {
        return problem(400, {
          code: 'HOME_ID_REQUIRED',
          errors: [{ field: 'fromHomeId', message: 'required' }],
        });
      }
      const home = this.publishedHome(fromHomeId);
      if (home?.status !== 'published') return problem(404);
      origin = fromHomeId;
    }
    if (!targetHomeId || !this.offered(targetHomeId)) return problem(404);
    // Repetir un descarte lo renueva: queda como la acción más reciente
    const previous = this.actions.findIndex(
      (action) =>
        action.kind === 'dismiss' &&
        action.fromHomeId === origin &&
        action.targetHomeId === targetHomeId,
    );
    if (previous >= 0) this.actions.splice(previous, 1);
    this.record({ kind: 'dismiss', fromHomeId: origin, targetHomeId });
    return new Response(null, { status: 204 });
  }

  private undo(homeId: string | null): Response {
    const roles = this.roles();
    let viewer: string | null = null;
    if (roles.includes('owner')) {
      if (!homeId) {
        return problem(400, {
          code: 'HOME_ID_REQUIRED',
          errors: [{ field: 'homeId', message: 'required' }],
        });
      }
      if (!this.publishedHome(homeId)) return problem(404);
      viewer = homeId;
    } else if (!roles.includes('seeker')) {
      return problem(403);
    }
    const last = this.actions.findLast((action) => action.fromHomeId === viewer);
    if (!last) return problem(404);
    if (last.kind === 'like' && this.matched.has(`${viewer ?? ''}>${last.targetHomeId}`)) {
      return problem(409, { code: 'LIKE_IN_MATCH' });
    }
    this.actions.splice(this.actions.lastIndexOf(last), 1);
    return new Response(null, { status: 204 });
  }

  private record(action: RecordedDecision): void {
    this.actions.push(action);
  }
}
