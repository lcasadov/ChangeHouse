import type { HomeStatus } from '@changehouse/shared';
import { sql } from 'drizzle-orm';

import type { CycleCandidates } from '../../../application/matching/matching-repository.js';
import type { CycleHome } from '../../../domain/matching/cycle.js';
import type { Executor } from './database.js';

/** Una vivienda de un ciclo con las preferencias efectivas de su dueño; importes como `float8`. */
interface MemberRow extends Record<string, unknown> {
  id: string;
  owner_id: string;
  status: HomeStatus;
  value_min_cents: number | null;
  value_max_cents: number | null;
  max_to_pay_cents: number | null;
  min_to_receive_cents: number | null;
  value_reference_pct: number | null;
}

function toCycleHome(row: MemberRow): CycleHome {
  const {
    max_to_pay_cents: maxToPayCents,
    min_to_receive_cents: minToReceiveCents,
    value_reference_pct: valueReferencePct,
  } = row;
  const hasTerms =
    maxToPayCents !== null && minToReceiveCents !== null && valueReferencePct !== null;
  return {
    homeId: row.id,
    ownerId: row.owner_id,
    status: row.status,
    valueMinCents: row.value_min_cents,
    valueMaxCents: row.value_max_cents,
    terms: hasTerms ? { maxToPayCents, minToReceiveCents, valueReferencePct } : null,
  };
}

/**
 * Ciclos candidatos en PostgreSQL (README §11). Lee las aristas y el estado actual de las viviendas
 * dentro de la transacción del me gusta; la validación (publicación y RN-03) es del dominio.
 */
export class DrizzleCycleCandidates implements CycleCandidates {
  constructor(private readonly db: Executor) {}

  async findCycles(fromHomeId: string, toHomeId: string): Promise<CycleHome[][]> {
    // Ciclo de 2: X → Y → X. Los de 3 (X → Y → Z → X) llegan con `add-chain-match`
    const back = await this.db.execute(sql`
      SELECT 1 FROM likes l
      WHERE l.from_home_id = ${toHomeId}::uuid AND l.to_home_id = ${fromHomeId}::uuid`);
    if ([...back].length === 0) return [];
    const members = await this.members([fromHomeId, toHomeId]);
    const cycle = [fromHomeId, toHomeId].map((id) => members.get(id));
    return cycle.every((member) => member !== undefined) ? [cycle] : [];
  }

  /** Las viviendas con las preferencias efectivas de su dueño: las de la vivienda o, si no, las suyas. */
  private async members(homeIds: readonly string[]): Promise<Map<string, CycleHome>> {
    const ids = sql.join(
      homeIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    const rows = await this.db.execute<MemberRow>(sql`
      SELECT h.id, h.owner_id, h.status,
             h.value_min_cents::float8 AS value_min_cents,
             h.value_max_cents::float8 AS value_max_cents,
             ep.max_to_pay_cents::float8 AS max_to_pay_cents,
             ep.min_to_receive_cents::float8 AS min_to_receive_cents,
             ep.value_reference_pct
      FROM homes h
      LEFT JOIN LATERAL (
        SELECT sp.max_to_pay_cents, sp.min_to_receive_cents, sp.value_reference_pct
        FROM search_preferences sp
        WHERE sp.home_id = h.id OR (sp.user_id = h.owner_id AND sp.home_id IS NULL)
        ORDER BY sp.home_id IS NULL
        LIMIT 1
      ) ep ON true
      WHERE h.id IN (${ids})`);
    return new Map([...rows].map((row) => [row.id, toCycleHome(row)]));
  }
}
