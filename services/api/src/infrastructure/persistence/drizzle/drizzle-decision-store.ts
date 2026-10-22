import { and, eq, gte, lt, sql } from 'drizzle-orm';

import type {
  DecisionOrigin,
  DecisionStore,
  LastAction,
} from '../../../application/decision/decision-repository.js';
import type { Executor } from './database.js';
import { accountDismissals, dismissals, homes, likes } from './schema.js';

/**
 * Espacio de los bloqueos asesores de pares de viviendas: la forma de dos enteros no se solapa con
 * la de un `bigint` que usa `lockUser`, así que un par nunca choca con un usuario.
 */
const PAIR_LOCK_SPACE = 2;

interface LastActionRow extends Record<string, unknown> {
  kind: 'like' | 'dismissal';
  target_home_id: string;
  at_ms: number;
}

/** Me gusta y descartes en PostgreSQL; todas las operaciones comparten la transacción del `Executor`. */
export class DrizzleDecisionStore implements DecisionStore {
  constructor(private readonly db: Executor) {}

  async lockUser(userId: string): Promise<void> {
    // Bloqueo asesor de la transacción: dos peticiones del mismo usuario no cuentan a la vez
    await this.db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);
  }

  async lockPair(pairKey: string): Promise<void> {
    await this.db.execute(
      sql`SELECT pg_advisory_xact_lock(${PAIR_LOCK_SPACE}::int, hashtext(${pairKey}))`,
    );
  }

  async countLikes(userId: string, start: Date, end: Date): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(likes)
      .innerJoin(homes, eq(homes.id, likes.fromHomeId))
      .where(and(eq(homes.ownerId, userId), gte(likes.createdAt, start), lt(likes.createdAt, end)));
    return row?.total ?? 0;
  }

  async likeExists(fromHomeId: string, toHomeId: string): Promise<boolean> {
    const rows = await this.db
      .select({ one: sql<number>`1` })
      .from(likes)
      .where(and(eq(likes.fromHomeId, fromHomeId), eq(likes.toHomeId, toHomeId)))
      .limit(1);
    return rows.length > 0;
  }

  async insertLike(fromHomeId: string, toHomeId: string, at: Date): Promise<void> {
    await this.db.insert(likes).values({ fromHomeId, toHomeId, createdAt: at });
  }

  async deleteLike(fromHomeId: string, toHomeId: string): Promise<void> {
    await this.db
      .delete(likes)
      .where(and(eq(likes.fromHomeId, fromHomeId), eq(likes.toHomeId, toHomeId)));
  }

  async saveDismissal(origin: DecisionOrigin, targetHomeId: string, at: Date): Promise<void> {
    if (origin.kind === 'home') {
      await this.db
        .insert(dismissals)
        .values({ homeId: origin.homeId, dismissedHomeId: targetHomeId, createdAt: at })
        .onConflictDoUpdate({
          target: [dismissals.homeId, dismissals.dismissedHomeId],
          set: { createdAt: at },
        });
      return;
    }
    await this.db
      .insert(accountDismissals)
      .values({ userId: origin.userId, dismissedHomeId: targetHomeId, createdAt: at })
      .onConflictDoUpdate({
        target: [accountDismissals.userId, accountDismissals.dismissedHomeId],
        set: { createdAt: at },
      });
  }

  async deleteDismissal(origin: DecisionOrigin, targetHomeId: string): Promise<void> {
    if (origin.kind === 'home') {
      await this.db
        .delete(dismissals)
        .where(
          and(eq(dismissals.homeId, origin.homeId), eq(dismissals.dismissedHomeId, targetHomeId)),
        );
      return;
    }
    await this.db
      .delete(accountDismissals)
      .where(
        and(
          eq(accountDismissals.userId, origin.userId),
          eq(accountDismissals.dismissedHomeId, targetHomeId),
        ),
      );
  }

  async lastAction(origin: DecisionOrigin): Promise<LastAction | null> {
    // En un empate de fecha gana el me gusta ('like' > 'dismissal'): deshacerlo devuelve cupo
    const query =
      origin.kind === 'home'
        ? sql`
            SELECT 'like' AS kind, l.to_home_id AS target_home_id,
                   (extract(epoch FROM l.created_at) * 1000)::float8 AS at_ms
            FROM likes l WHERE l.from_home_id = ${origin.homeId}::uuid
            UNION ALL
            SELECT 'dismissal', d.dismissed_home_id, (extract(epoch FROM d.created_at) * 1000)::float8
            FROM dismissals d WHERE d.home_id = ${origin.homeId}::uuid
            ORDER BY at_ms DESC, kind DESC LIMIT 1`
        : sql`
            SELECT 'dismissal' AS kind, d.dismissed_home_id AS target_home_id,
                   (extract(epoch FROM d.created_at) * 1000)::float8 AS at_ms
            FROM account_dismissals d WHERE d.user_id = ${origin.userId}::uuid
            ORDER BY at_ms DESC LIMIT 1`;
    const [row] = [...(await this.db.execute<LastActionRow>(query))];
    return row
      ? { kind: row.kind, targetHomeId: row.target_home_id, at: new Date(Math.round(row.at_ms)) }
      : null;
  }
}
