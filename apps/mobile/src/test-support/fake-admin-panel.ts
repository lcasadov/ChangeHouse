import type { components } from '../api/schema';
import { json, problem } from './http-responses';

export type Metrics = components['schemas']['Metrics'];
export type AuditEntry = components['schemas']['AuditEntry'];
export type WaitlistEntry = components['schemas']['WaitlistEntry'];
type AdminUser = components['schemas']['AdminUser'];

const DEFAULT_LIMIT = 20;
const CURSOR_PREFIX = 'cursor-';
const CSV_HEADER = 'email,municipality,homeType,lookingFor,consentAt';

/** Métricas de ejemplo; cada prueba cambia solo lo que le importa. */
export function metrics(overrides: Partial<Metrics> = {}): Metrics {
  return {
    signups: 42,
    publishedHomesByZone: [
      { zone: 'Malasaña', count: 7 },
      { zone: 'Chamberí', count: 3 },
    ],
    likes: 120,
    matches: { direct: 9, chain: 4 },
    operations: 2,
    ...overrides,
  };
}

let sequence = 0;

export function auditEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  sequence += 1;
  return {
    id: sequence,
    actorId: '0198f3a0-0000-7000-8000-0000000000a1',
    action: 'home.approved',
    entity: 'home',
    entityId: `0198f3a0-cccc-7000-8000-${String(sequence).padStart(12, '0')}`,
    at: '2026-10-10T10:00:00.000Z',
    ...overrides,
  };
}

export function waitlistEntry(overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
  sequence += 1;
  return {
    email: `espera${String(sequence)}@example.com`,
    municipality: 'Madrid',
    homeType: 'piso',
    lookingFor: 'Piso más grande',
    consentAt: '2026-10-05T09:00:00.000Z',
    ...overrides,
  };
}

const normalized = (text: string) =>
  text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase();

function page<T>(all: readonly T[], search: URLSearchParams): Response {
  const cursor = search.get('cursor');
  const start = cursor?.startsWith(CURSOR_PREFIX) ? Number(cursor.slice(CURSOR_PREFIX.length)) : 0;
  const next = start + Number(search.get('limit') ?? DEFAULT_LIMIT);
  return json(200, {
    items: all.slice(start, next),
    nextCursor: next < all.length ? `${CURSOR_PREFIX}${String(next)}` : null,
  });
}

/**
 * El panel de administración con las reglas de la API (`adminGetMetrics`, `adminListUsers`,
 * `adminListAuditLog`, `adminListWaitlist`): periodo invertido 400, búsqueda sin mayúsculas ni
 * tildes, auditoría del más reciente al más antiguo y la lista de espera en JSON o CSV.
 */
export class FakeAdminPanel {
  metrics: Metrics = metrics();
  readonly audit: AuditEntry[] = [];
  readonly waitlist: WaitlistEntry[] = [];

  constructor(private readonly users: () => readonly AdminUser[]) {}

  /** Lo que responde bajo `/admin/…` del panel, o `null` si la ruta es de otra cosa. */
  respond(
    path: string,
    method: string,
    search: URLSearchParams,
    accept: string | null,
  ): Response | null {
    if (method !== 'GET') return null;
    if (path === '/admin/metrics') return this.getMetrics(search);
    if (path === '/admin/users') return this.listUsers(search);
    if (path === '/admin/audit-log') {
      return page(
        [...this.audit].sort((a, b) => b.at.localeCompare(a.at)),
        search,
      );
    }
    if (path === '/admin/waitlist') return this.listWaitlist(search, accept);
    return null;
  }

  private getMetrics(search: URLSearchParams): Response {
    const from = search.get('from');
    const to = search.get('to');
    if (from === null || to === null) return problem(400);
    if (to < from) {
      return problem(400, { errors: [{ field: 'to', message: 'Debe ser posterior a from' }] });
    }
    return json(200, this.metrics);
  }

  private listUsers(search: URLSearchParams): Response {
    const query = normalized(search.get('q') ?? '');
    const matching = this.users().filter(
      (user) =>
        normalized(user.email).includes(query) || normalized(user.displayName).includes(query),
    );
    return page(matching, search);
  }

  private listWaitlist(search: URLSearchParams, accept: string | null): Response {
    const municipality = search.get('municipality');
    const matching = this.waitlist.filter(
      (entry) =>
        municipality === null || normalized(entry.municipality) === normalized(municipality),
    );
    if (accept?.includes('text/csv')) {
      const rows = matching.map((entry) =>
        [entry.email, entry.municipality, entry.homeType, entry.lookingFor, entry.consentAt].join(
          ',',
        ),
      );
      return new Response([CSV_HEADER, ...rows].join('\n'), {
        status: 200,
        headers: { 'content-type': 'text/csv' },
      });
    }
    return page(matching, search);
  }
}
