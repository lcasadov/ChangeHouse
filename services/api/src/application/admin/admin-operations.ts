import { type AssignedRole, deriveRole } from '../../domain/account/role.js';
import type { Period } from '../../domain/admin/period.js';
import type { HomeType } from '../../domain/waitlist/waitlist-entry.js';
import { encodeCursor, type ModerationCursor } from '../moderation/cursor.js';
import type { AdminUserView } from '../moderation/user-suspension.js';

/** Máximo de filas por lectura al exportar la lista de espera completa. */
const EXPORT_BATCH = 500;

/** Métricas del producto (`Metrics` del contrato). */
export interface ProductMetrics {
  signups: number;
  publishedHomesByZone: { zone: string; count: number }[];
  likes: number;
  matches: { direct: number; chain: number };
  operations: number;
}

/** Puerto de salida: consultas agregadas de solo lectura sobre una ventana `[start, end)`. */
export interface MetricsReader {
  read(window: Pick<Period, 'start' | 'end'>): Promise<ProductMetrics>;
}

/** Una cuenta tal como la lee el directorio del admin. */
export interface DirectoryUser {
  id: string;
  email: string;
  displayName: string;
  assignedRole: AssignedRole | null;
  hasPublishedHome: boolean;
  suspended: boolean;
  createdAt: Date;
}

/** Puerto de salida: usuarios de la más reciente a la más antigua; `q` busca por prefijo de email o nombre. */
export interface UserDirectory {
  search(query: { q?: string; after?: ModerationCursor; limit: number }): Promise<DirectoryUser[]>;
}

export interface AuditRecord {
  id: number;
  /** `null` en las entradas del sistema (la purga de retención). */
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  at: Date;
}

/** Puerto de salida: el registro de auditoría, del más reciente al más antiguo. Solo lectura. */
export interface AuditReader {
  list(query: { after?: ModerationCursor; limit: number }): Promise<AuditRecord[]>;
}

export interface WaitlistRecord {
  id: string;
  email: string;
  municipality: string;
  homeType: HomeType;
  lookingFor: string;
  consentAt: Date;
}

/** Puerto de salida: la lista de espera, de la alta más reciente a la más antigua. */
export interface WaitlistReader {
  list(query: {
    municipality?: string;
    after?: ModerationCursor;
    limit: number;
  }): Promise<WaitlistRecord[]>;
}

export interface AdminPanelDeps {
  metrics: MetricsReader;
  users: UserDirectory;
  audit: AuditReader;
  waitlist: WaitlistReader;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AuditEntryView {
  id: number;
  /** `null` en las entradas del sistema (la purga de retención). */
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  at: string;
}

/** `WaitlistEntry` del contrato. */
export interface WaitlistEntryView {
  email: string;
  municipality: string;
  homeType: HomeType;
  lookingFor: string;
  consentAt: string;
}

export interface AdminUsersQuery {
  q?: string;
  cursor?: ModerationCursor | undefined;
  limit: number;
}

export interface AdminAuditQuery {
  cursor?: ModerationCursor | undefined;
  limit: number;
}

export interface AdminWaitlistQuery {
  municipality?: string;
  cursor?: ModerationCursor | undefined;
  limit: number;
}

/** Las operaciones del panel de administración, tal como las consume el transporte. */
export interface AdminPanelOperations {
  adminGetMetrics(period: Period): Promise<ProductMetrics>;
  adminListUsers(query: AdminUsersQuery): Promise<Page<AdminUserView>>;
  adminListAuditLog(query: AdminAuditQuery): Promise<Page<AuditEntryView>>;
  adminListWaitlist(query: AdminWaitlistQuery): Promise<Page<WaitlistEntryView>>;
  adminExportWaitlist(query: { municipality?: string }): Promise<WaitlistEntryView[]>;
}

/** Una fila más de las pedidas indica que hay otra página; el cursor apunta a la última devuelta. */
function paginate<R, V>(
  found: R[],
  limit: number,
  toView: (row: R) => V,
  cursorOf: (row: R) => ModerationCursor,
): Page<V> {
  const rows = found.slice(0, limit);
  const last = rows.at(-1);
  return {
    items: rows.map(toView),
    nextCursor: found.length > limit && last ? encodeCursor(cursorOf(last)) : null,
  };
}

function toUserView(user: DirectoryUser): AdminUserView {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: [deriveRole(user.assignedRole, user.hasPublishedHome)],
    suspended: user.suspended,
    createdAt: user.createdAt.toISOString(),
  };
}

function toAuditView(entry: AuditRecord): AuditEntryView {
  return { ...entry, at: entry.at.toISOString() };
}

function toWaitlistView(entry: WaitlistRecord): WaitlistEntryView {
  return {
    email: entry.email,
    municipality: entry.municipality,
    homeType: entry.homeType,
    lookingFor: entry.lookingFor,
    consentAt: entry.consentAt.toISOString(),
  };
}

/** Todas las altas que cumplen el filtro, leídas por lotes para no cargar una sola consulta enorme. */
async function exportWaitlist(
  reader: WaitlistReader,
  filter: { municipality?: string },
): Promise<WaitlistEntryView[]> {
  const exported: WaitlistEntryView[] = [];
  let after: ModerationCursor | undefined;
  for (;;) {
    const batch = await reader.list({
      ...(filter.municipality === undefined ? {} : { municipality: filter.municipality }),
      ...(after ? { after } : {}),
      limit: EXPORT_BATCH,
    });
    exported.push(...batch.map(toWaitlistView));
    const last = batch.at(-1);
    if (batch.length < EXPORT_BATCH || !last) return exported;
    after = { at: last.consentAt, id: last.id };
  }
}

/** Casos de uso de consulta del panel de administración (RF-90, RF-91, RF-93, RF-101). */
export function adminOperations(deps: AdminPanelDeps): AdminPanelOperations {
  return {
    adminGetMetrics: (period) => deps.metrics.read({ start: period.start, end: period.end }),

    adminListUsers: async (query) =>
      paginate(
        await deps.users.search({
          ...(query.q === undefined ? {} : { q: query.q }),
          ...(query.cursor ? { after: query.cursor } : {}),
          limit: query.limit + 1,
        }),
        query.limit,
        toUserView,
        (user) => ({ at: user.createdAt, id: user.id }),
      ),

    adminListAuditLog: async (query) =>
      paginate(
        await deps.audit.list({
          ...(query.cursor ? { after: query.cursor } : {}),
          limit: query.limit + 1,
        }),
        query.limit,
        toAuditView,
        (entry) => ({ at: entry.at, id: String(entry.id) }),
      ),

    adminListWaitlist: async (query) =>
      paginate(
        await deps.waitlist.list({
          ...(query.municipality === undefined ? {} : { municipality: query.municipality }),
          ...(query.cursor ? { after: query.cursor } : {}),
          limit: query.limit + 1,
        }),
        query.limit,
        toWaitlistView,
        (entry) => ({ at: entry.consentAt, id: entry.id }),
      ),

    adminExportWaitlist: (query) => exportWaitlist(deps.waitlist, query),
  };
}
