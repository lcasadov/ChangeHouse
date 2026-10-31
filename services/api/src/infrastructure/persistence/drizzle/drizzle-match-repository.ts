import { and, asc, desc, eq, inArray, ne, type SQL, sql } from 'drizzle-orm';

import type { MatchLookup } from '../../../application/decision/decision-repository.js';
import type {
  MatchDecisionStore,
  MatchListQuery,
  MatchParticipantRecord,
  MatchReader,
  MatchRecord,
  MatchWriter,
  NewMatch,
} from '../../../application/matching/matching-repository.js';
import type { SuspensionMatchStore } from '../../../application/moderation/user-suspension.js';
import type { CycleType } from '../../../domain/matching/cycle.js';
import {
  type MatchState,
  NEW_MATCH_STATUS,
  NEW_PARTICIPANT_STATUS,
} from '../../../domain/matching/match.js';
import type { Executor } from './database.js';
import { matches, matchParticipants, users } from './schema.js';

type MatchRow = typeof matches.$inferSelect;

/**
 * Matches en PostgreSQL. Funciona igual dentro de la transacción del me gusta (crear y leer el
 * match recién creado) que fuera de ella (listar y consultar si un me gusta forma parte de uno).
 */
export class DrizzleMatchRepository
  implements MatchWriter, MatchReader, MatchLookup, MatchDecisionStore, SuspensionMatchStore
{
  constructor(private readonly db: Executor) {}

  async saveMatch(match: NewMatch): Promise<string> {
    // La clave única resuelve la carrera: si otra transacción ya creó el ciclo, no se inserta nada
    const [created] = await this.db
      .insert(matches)
      .values({
        id: match.id,
        type: match.cycle.type,
        status: NEW_MATCH_STATUS,
        cycleKey: match.cycle.cycleKey,
        createdAt: match.createdAt,
      })
      .onConflictDoNothing({ target: matches.cycleKey })
      .returning({ id: matches.id });
    if (created) {
      await this.db.insert(matchParticipants).values(
        match.cycle.participants.map((participant) => ({
          matchId: created.id,
          homeId: participant.homeId,
          userId: participant.userId,
          givesHomeId: participant.givesHomeId,
          receivesHomeId: participant.receivesHomeId,
          compensationCents: participant.compensationCents,
          status: NEW_PARTICIPANT_STATUS,
        })),
      );
      return created.id;
    }
    const [existing] = await this.db
      .select({ id: matches.id })
      .from(matches)
      .where(eq(matches.cycleKey, match.cycle.cycleKey));
    if (!existing) throw new Error('El match del ciclo ni se creó ni existe');
    return existing.id;
  }

  async findMatch(id: string): Promise<MatchRecord | null> {
    const rows = await this.db.select().from(matches).where(eq(matches.id, id));
    const [record] = await this.withParticipants(rows);
    return record ?? null;
  }

  findById(id: string): Promise<MatchRecord | null> {
    return this.findMatch(id);
  }

  async findForUpdate(id: string): Promise<MatchRecord | null> {
    // Serializa confirmaciones, retiradas y cambios de teléfono sobre el mismo match
    const rows = await this.db.select().from(matches).where(eq(matches.id, id)).for('update');
    const [record] = await this.withParticipants(rows);
    return record ?? null;
  }

  async findActiveForUpdate(userId: string): Promise<MatchRecord[]> {
    // Bloquea los matches activos del usuario: una confirmación simultánea espera al cierre
    const rows = await this.db
      .select()
      .from(matches)
      .where(
        and(
          inArray(matches.status, ['open', 'confirmed']),
          sql`EXISTS (SELECT 1 FROM match_participants p
                      WHERE p.match_id = ${matches.id} AND p.user_id = ${userId}::uuid)`,
        ),
      )
      .orderBy(asc(matches.createdAt), asc(matches.id))
      .for('update');
    return this.withParticipants(rows);
  }

  async saveState(id: string, state: MatchState): Promise<void> {
    await this.db.update(matches).set({ status: state.status }).where(eq(matches.id, id));
    for (const participant of state.participants) {
      await this.db
        .update(matchParticipants)
        .set({ status: participant.status })
        .where(
          and(eq(matchParticipants.matchId, id), eq(matchParticipants.homeId, participant.homeId)),
        );
    }
  }

  async setPhoneSharing(matchId: string, userId: string, share: boolean): Promise<void> {
    await this.db
      .update(matchParticipants)
      .set({ sharesPhone: share })
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, userId)));
  }

  async phoneSharing(matchId: string): Promise<ReadonlySet<string>> {
    const rows = await this.db
      .select({ userId: matchParticipants.userId })
      .from(matchParticipants)
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.sharesPhone, true)));
    return new Set(rows.map((row) => row.userId));
  }

  async sharedPhones(matchId: string): Promise<ReadonlyMap<string, string>> {
    const rows = await this.db
      .select({ userId: users.id, phone: users.phone })
      .from(matchParticipants)
      .innerJoin(users, eq(users.id, matchParticipants.userId))
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.sharesPhone, true)));
    const phones = new Map<string, string>();
    for (const { userId, phone } of rows) {
      if (phone !== null) phones.set(userId, phone);
    }
    return phones;
  }

  async listForUser(query: MatchListQuery): Promise<MatchRecord[]> {
    const conditions: SQL[] = [
      sql`EXISTS (SELECT 1 FROM match_participants p
                  WHERE p.match_id = ${matches.id} AND p.user_id = ${query.userId}::uuid)`,
    ];
    if (query.status !== undefined) conditions.push(eq(matches.status, query.status));
    if (query.after !== undefined) {
      conditions.push(
        sql`(${matches.createdAt}, ${matches.id}) < (${query.after.at.toISOString()}::timestamptz, ${query.after.id}::uuid)`,
      );
    }
    const rows = await this.db
      .select()
      .from(matches)
      .where(and(...conditions))
      .orderBy(desc(matches.createdAt), desc(matches.id))
      .limit(query.limit);
    return this.withParticipants(rows);
  }

  async isLikeInMatch(fromHomeId: string, toHomeId: string): Promise<boolean> {
    const rows = await this.db
      .select({ one: sql<number>`1` })
      .from(matchParticipants)
      .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
      .where(
        and(
          eq(matchParticipants.givesHomeId, fromHomeId),
          eq(matchParticipants.receivesHomeId, toHomeId),
          ne(matches.status, 'closed'),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  /** Los participantes de cada match, con el nombre visible de su propietario, por vivienda. */
  private async withParticipants(rows: readonly MatchRow[]): Promise<MatchRecord[]> {
    if (rows.length === 0) return [];
    const participants = await this.db
      .select({
        matchId: matchParticipants.matchId,
        homeId: matchParticipants.homeId,
        userId: matchParticipants.userId,
        displayName: users.displayName,
        givesHomeId: matchParticipants.givesHomeId,
        receivesHomeId: matchParticipants.receivesHomeId,
        compensationCents: matchParticipants.compensationCents,
        status: matchParticipants.status,
      })
      .from(matchParticipants)
      .innerJoin(users, eq(users.id, matchParticipants.userId))
      .where(
        inArray(
          matchParticipants.matchId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(asc(matchParticipants.homeId));
    const byMatch = new Map<string, MatchParticipantRecord[]>();
    for (const { matchId, ...participant } of participants) {
      byMatch.set(matchId, [...(byMatch.get(matchId) ?? []), participant]);
    }
    return rows.map((row) => ({
      id: row.id,
      type: row.type as CycleType,
      status: row.status,
      createdAt: row.createdAt,
      participants: byMatch.get(row.id) ?? [],
    }));
  }
}
