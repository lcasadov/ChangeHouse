import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';

import type {
  AccountExportReader,
  ExportedDismissal,
  ExportedLike,
  ExportedMatch,
  ExportedParticipation,
} from '../../../application/account/account-export.js';
import type { CycleType } from '../../../domain/matching/cycle.js';
import type { Executor } from './database.js';
import {
  accountDismissals,
  dismissals,
  homes,
  likes,
  matches,
  matchParticipants,
} from './schema.js';

/** Lecturas de la exportación de datos del usuario en PostgreSQL. */
export class DrizzleAccountExportReader implements AccountExportReader {
  constructor(private readonly db: Executor) {}

  likesOf(userId: string): Promise<ExportedLike[]> {
    return this.db
      .select({
        fromHomeId: likes.fromHomeId,
        toHomeId: likes.toHomeId,
        createdAt: likes.createdAt,
      })
      .from(likes)
      .innerJoin(homes, eq(homes.id, likes.fromHomeId))
      .where(eq(homes.ownerId, userId))
      .orderBy(asc(likes.createdAt), asc(likes.fromHomeId), asc(likes.toHomeId));
  }

  async dismissalsOf(userId: string): Promise<ExportedDismissal[]> {
    const fromHomes = await this.db
      .select({
        homeId: dismissals.homeId,
        dismissedHomeId: dismissals.dismissedHomeId,
        createdAt: dismissals.createdAt,
      })
      .from(dismissals)
      .innerJoin(homes, eq(homes.id, dismissals.homeId))
      .where(eq(homes.ownerId, userId));
    const fromAccount = await this.db
      .select({
        dismissedHomeId: accountDismissals.dismissedHomeId,
        createdAt: accountDismissals.createdAt,
      })
      .from(accountDismissals)
      .where(eq(accountDismissals.userId, userId));
    return [...fromHomes, ...fromAccount.map((row) => ({ homeId: null, ...row }))].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  async matchesOf(userId: string): Promise<ExportedMatch[]> {
    const own = await this.db
      .select({
        matchId: matches.id,
        type: matches.type,
        status: matches.status,
        createdAt: matches.createdAt,
        homeId: matchParticipants.homeId,
        givesHomeId: matchParticipants.givesHomeId,
        receivesHomeId: matchParticipants.receivesHomeId,
        compensationCents: matchParticipants.compensationCents,
        participantStatus: matchParticipants.status,
        sharesPhone: matchParticipants.sharesPhone,
      })
      .from(matchParticipants)
      .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
      .where(eq(matchParticipants.userId, userId))
      .orderBy(desc(matches.createdAt), desc(matches.id), asc(matchParticipants.homeId));
    if (own.length === 0) return [];

    // De los demás participantes, solo el identificador de su vivienda: nada de sus datos personales
    const others = await this.db
      .select({ matchId: matchParticipants.matchId, homeId: matchParticipants.homeId })
      .from(matchParticipants)
      .where(
        and(
          inArray(matchParticipants.matchId, [...new Set(own.map((row) => row.matchId))]),
          ne(matchParticipants.userId, userId),
        ),
      )
      .orderBy(asc(matchParticipants.homeId));

    const byMatch = new Map<string, ExportedMatch & { participation: ExportedParticipation[] }>();
    for (const row of own) {
      const participation: ExportedParticipation = {
        homeId: row.homeId,
        givesHomeId: row.givesHomeId,
        receivesHomeId: row.receivesHomeId,
        compensationCents: row.compensationCents,
        status: row.participantStatus,
        sharesPhone: row.sharesPhone,
      };
      const known = byMatch.get(row.matchId);
      if (known) known.participation.push(participation);
      else {
        byMatch.set(row.matchId, {
          id: row.matchId,
          type: row.type as CycleType,
          status: row.status,
          createdAt: row.createdAt,
          participation: [participation],
          otherHomeIds: others.filter((o) => o.matchId === row.matchId).map((o) => o.homeId),
        });
      }
    }
    return [...byMatch.values()];
  }
}
