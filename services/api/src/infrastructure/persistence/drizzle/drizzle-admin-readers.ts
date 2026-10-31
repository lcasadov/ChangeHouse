import {
  and,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  lt,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

import type {
  AuditReader,
  AuditRecord,
  DirectoryUser,
  MetricsReader,
  ProductMetrics,
  UserDirectory,
  WaitlistReader,
  WaitlistRecord,
} from '../../../application/admin/admin-operations.js';
import type { ModerationCursor } from '../../../application/moderation/cursor.js';
import { normalizeMunicipality } from '../../../domain/search-preferences/search-preferences.js';
import type { Database } from './database.js';
import { auditLog, homes, likes, matches, users, waitlist } from './schema.js';

/** Estados que hacen propietario a su dueño (`docs/rbac-matrix.md` §1). */
const OWNING_STATUSES = ['published', 'paused', 'in_operation'] as const;
const DIRECT_MATCH = 2;
const CHAIN_MATCH = 3;
const ACCENTED = 'áàäâéèëêíìïîóòöôúùüûñç';
const PLAIN = 'aaaaeeeeiiiioooouuuunc';

/** Texto en minúsculas y sin tildes, para comparar sin distinguirlas (equivale a `normalizeMunicipality`). */
const folded = (column: PgColumn | SQL): SQL =>
  sql`translate(lower(${column}), ${ACCENTED}, ${PLAIN})`;

/** Prefijo para `LIKE ... ESCAPE '\'`: los comodines del texto buscado se toman literalmente. */
const likePrefix = (text: string): string =>
  `${normalizeMunicipality(text).replace(/[\\%_]/g, '\\$&')}%`;

/** Posición siguiente de un listado descendente por (fecha, id): estrictamente anterior al cursor. */
function before(
  at: PgColumn,
  id: PgColumn | SQL,
  cursor: ModerationCursor | undefined,
  key: string | number,
): SQL | undefined {
  return cursor ? or(lt(at, cursor.at), and(eq(at, cursor.at), sql`${id} < ${key}`)) : undefined;
}

/** Métricas del producto: agregados de solo lectura sobre una ventana `[start, end)`. */
export class DrizzleMetricsReader implements MetricsReader {
  constructor(private readonly db: Database) {}

  async read(window: { start: Date; end: Date }): Promise<ProductMetrics> {
    const within = (column: PgColumn) => and(gte(column, window.start), lt(column, window.end));
    const [signups] = await this.db
      .select({ total: count() })
      .from(users)
      .where(within(users.createdAt));
    const [likeTotal] = await this.db
      .select({ total: count() })
      .from(likes)
      .where(within(likes.createdAt));
    const [matchTotals] = await this.db
      .select({
        direct: sql<number>`count(*) filter (where ${matches.type} = ${DIRECT_MATCH})::int`,
        chain: sql<number>`count(*) filter (where ${matches.type} = ${CHAIN_MATCH})::int`,
        operations: sql<number>`count(*) filter (where ${matches.status} = 'in_operation')::int`,
      })
      .from(matches)
      .where(within(matches.createdAt));
    const zone = sql<string>`coalesce(nullif(${homes.municipality}, ''), ${homes.areaName})`;
    const zones = await this.db
      .select({ zone, total: count() })
      .from(homes)
      .where(within(homes.publishedAt))
      .groupBy(zone)
      .orderBy(desc(count()), zone);
    return {
      signups: signups?.total ?? 0,
      publishedHomesByZone: zones.map((row) => ({ zone: row.zone, count: row.total })),
      likes: likeTotal?.total ?? 0,
      matches: { direct: matchTotals?.direct ?? 0, chain: matchTotals?.chain ?? 0 },
      operations: matchTotals?.operations ?? 0,
    };
  }
}

/** Directorio de cuentas (no borradas), de la más reciente a la más antigua. */
export class DrizzleUserDirectory implements UserDirectory {
  constructor(private readonly db: Database) {}

  async search(query: {
    q?: string;
    after?: ModerationCursor;
    limit: number;
  }): Promise<DirectoryUser[]> {
    const prefix = query.q === undefined ? undefined : likePrefix(query.q);
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        assignedRole: users.assignedRole,
        hasPublishedHome: sql<boolean>`${exists(
          this.db
            .select({ one: sql`1` })
            .from(homes)
            .where(and(eq(homes.ownerId, users.id), inArray(homes.status, OWNING_STATUSES))),
        )}`,
        suspendedAt: users.suspendedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          prefix === undefined
            ? undefined
            : or(
                sql`${folded(users.email)} LIKE ${prefix} ESCAPE '\\'`,
                sql`${folded(users.displayName)} LIKE ${prefix} ESCAPE '\\'`,
              ),
          before(users.createdAt, users.id, query.after, query.after?.id ?? ''),
        ),
      )
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(query.limit);
    return rows.map(({ suspendedAt, ...row }) => ({ ...row, suspended: suspendedAt !== null }));
  }
}

/** Lectura del registro de auditoría: nunca escribe (la tabla además rechaza cambios). */
export class DrizzleAuditReader implements AuditReader {
  constructor(private readonly db: Database) {}

  async list(query: { after?: ModerationCursor; limit: number }): Promise<AuditRecord[]> {
    const rows = await this.db
      .select()
      .from(auditLog)
      .where(before(auditLog.at, auditLog.id, query.after, Number(query.after?.id ?? 0)))
      .orderBy(desc(auditLog.at), desc(auditLog.id))
      .limit(query.limit);
    return rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      at: row.at,
    }));
  }
}

/** Lista de espera, de la alta más reciente a la más antigua; el municipio no distingue tildes ni mayúsculas. */
export class DrizzleWaitlistReader implements WaitlistReader {
  constructor(private readonly db: Database) {}

  async list(query: {
    municipality?: string;
    after?: ModerationCursor;
    limit: number;
  }): Promise<WaitlistRecord[]> {
    const rows = await this.db
      .select()
      .from(waitlist)
      .where(
        and(
          query.municipality === undefined
            ? undefined
            : sql`${folded(waitlist.municipality)} = ${normalizeMunicipality(query.municipality)}`,
          before(waitlist.consentAt, waitlist.id, query.after, query.after?.id ?? ''),
        ),
      )
      .orderBy(desc(waitlist.consentAt), desc(waitlist.id))
      .limit(query.limit);
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      municipality: row.municipality,
      homeType: row.homeType,
      lookingFor: row.lookingFor,
      consentAt: row.consentAt,
    }));
  }
}
