import type { components } from '../../api/schema';
import type { Home } from '../homes/homes-api';

/** Un usuario tal como lo ve el admin (`AdminUser` del contrato). */
export type AdminUser = components['schemas']['AdminUser'];

/** Las métricas de un periodo (`Metrics`). */
export type Metrics = components['schemas']['Metrics'];

/** Una acción del registro de auditoría (`AuditEntry`). */
export type AuditEntry = components['schemas']['AuditEntry'];

/** Una inscripción en la lista de espera (`WaitlistEntry`). */
export type WaitlistEntry = components['schemas']['WaitlistEntry'];

/** Una denuncia (`Report`): lo que se denuncia, el motivo y su estado de revisión. */
export type Report = components['schemas']['Report'];

export type AdminApiErrorKind =
  /** Sin respuesta del servidor: red caída o tiempo agotado. */
  | 'network'
  /** El token no vale (401). */
  | 'unauthorized'
  /** La persona no tiene el rol `admin` (403). */
  | 'forbidden'
  /** La vivienda, el usuario o la denuncia no existen (404). */
  | 'not-found'
  /** La vivienda no está en revisión o la denuncia ya está cerrada: otra persona la resolvió (409). */
  | 'conflict'
  /** El servidor rechaza la decisión, p. ej. un rechazo sin motivo (400). */
  | 'invalid'
  /** El admin intenta suspenderse a sí mismo (409 `CANNOT_SUSPEND_SELF`). */
  | 'cannot-suspend-self'
  /** El admin intenta suspender a otro admin (409 `CANNOT_SUSPEND_ADMIN`). */
  | 'cannot-suspend-admin'
  | 'server';

export class AdminApiError extends Error {
  constructor(readonly kind: AdminApiErrorKind) {
    super(kind);
    this.name = 'AdminApiError';
  }
}

/** Una página de la cola de moderación (`adminListHomes`). */
export interface ModerationPage {
  items: Home[];
  /** Cursor opaco de la página siguiente, o `null` si no hay más. */
  nextCursor: string | null;
}

/** La decisión sobre una vivienda en revisión (`adminModerateHome`); rechazar exige motivo. */
export type ModerationDecision = { decision: 'approve' } | { decision: 'reject'; reason: string };

/** Suspender o reactivar a un usuario (`adminSetUserSuspension`); el motivo es siempre obligatorio. */
export interface SuspensionDecision {
  suspended: boolean;
  reason: string;
}

/** Una página de la cola de denuncias abiertas (`adminListReports`). */
export interface ReportsPage {
  items: Report[];
  nextCursor: string | null;
}

/** Cómo cierra el admin una denuncia, siempre con nota (`adminResolveReport`). */
export interface ReportResolution {
  status: 'resolved' | 'dismissed';
  resolution: string;
}

/** Periodo de las métricas en días naturales (`AAAA-MM-DD`). */
export interface MetricsPeriod {
  from: string;
  to: string;
}

/** Una página de usuarios (`adminListUsers`). */
export interface UsersPage {
  items: AdminUser[];
  nextCursor: string | null;
}

/** Una página de la auditoría (`adminListAuditLog`). */
export interface AuditPage {
  items: AuditEntry[];
  nextCursor: string | null;
}

/** Una página de la lista de espera (`adminListWaitlist`). */
export interface WaitlistPage {
  items: WaitlistEntry[];
  nextCursor: string | null;
}

/** Puerto de salida de la administración; el adaptador HTTP vive en `http-admin-api.ts`. */
export interface AdminApi {
  /** La cola: viviendas en revisión de la enviada antes a la enviada después. */
  listPending: (cursor?: string) => Promise<ModerationPage>;
  /** Aprueba o rechaza una vivienda en revisión y devuelve su ficha ya actualizada. */
  moderate: (homeId: string, decision: ModerationDecision) => Promise<Home>;
  /** Suspende o reactiva a un usuario y lo devuelve ya actualizado. */
  setUserSuspension: (userId: string, decision: SuspensionDecision) => Promise<AdminUser>;
  /** Las denuncias abiertas, de la más antigua a la más reciente. */
  listReports: (cursor?: string) => Promise<ReportsPage>;
  /** Resuelve o desestima una denuncia con su nota y devuelve la denuncia ya cerrada. */
  resolveReport: (reportId: string, resolution: ReportResolution) => Promise<Report>;
  /** Las métricas del periodo; un periodo invertido rechaza con `invalid`. */
  getMetrics: (period: MetricsPeriod) => Promise<Metrics>;
  /** Los usuarios, con búsqueda opcional por email o nombre visible. */
  listUsers: (query: { q?: string; cursor?: string }) => Promise<UsersPage>;
  /** La auditoría, de la acción más reciente a la más antigua. */
  listAuditLog: (cursor?: string) => Promise<AuditPage>;
  /** La lista de espera, con filtro opcional por municipio. */
  listWaitlist: (query: { municipality?: string; cursor?: string }) => Promise<WaitlistPage>;
  /** La lista de espera en CSV (`Accept: text/csv`), con el mismo filtro. */
  exportWaitlist: (municipality?: string) => Promise<string>;
}
