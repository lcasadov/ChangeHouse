import type { ReportStatus } from '@changehouse/shared';

import type { Report } from '../../domain/moderation/report.js';
import type { ModerationCursor } from './cursor.js';

/** Una página de la cola de revisión: las denuncias de un estado, de la más antigua a la más reciente. */
export interface ReportListing {
  status: ReportStatus;
  /** Continúa tras esta posición (exclusiva): fecha de creación e id. */
  after?: ModerationCursor | undefined;
  limit: number;
}

/** Puerto de salida: almacén de denuncias. */
export interface ReportRepository {
  insert(report: Report): Promise<void>;
  /** Bloquea la fila hasta el final de la transacción en curso, para que dos admins no resuelvan a la vez. */
  findByIdForUpdate(id: string): Promise<Report | null>;
  save(report: Report): Promise<void>;
  listByStatus(query: ReportListing): Promise<Report[]>;
}
