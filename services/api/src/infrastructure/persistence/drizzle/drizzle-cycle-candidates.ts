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

/** La tercera vivienda de un ciclo candidato; `null` en el ciclo de 2. */
interface CandidateRow extends Record<string, unknown> {
  third_id: string | null;
}

/** El dueño de la vivienda `alias` no está suspendido: sus viviendas no forman matches (RF-90). */
const ownerActive = (alias: string) =>
  sql.raw(`NOT EXISTS (SELECT 1 FROM users u
                        WHERE u.id = ${alias}.owner_id AND u.suspended_at IS NOT NULL)`);

/**
 * Cadenas candidatas que se leen como mucho por cada me gusta: en un grafo denso alrededor de una
 * vivienda, las demás siguen disponibles para me gusta posteriores (design.md).
 */
export const MAX_CHAIN_CANDIDATES = 100;

/**
 * Ciclos candidatos en PostgreSQL (README §11). Lee las aristas y el estado actual de las viviendas
 * dentro de la transacción del me gusta; la validación (publicación y RN-03) es del dominio.
 */
export class DrizzleCycleCandidates implements CycleCandidates {
  constructor(private readonly db: Executor) {}

  /**
   * Primero el ciclo de 2 (X → Y → X) y después los de 3 (X → Y → Z → X) cuya tercera vivienda está
   * publicada y es de un tercer propietario, del que lleva más tiempo esperando (su me gusta más
   * reciente, el más antiguo) al que menos y, a igualdad, por vivienda. Ninguna vivienda de un
   * propietario suspendido forma ciclo. No hay recursión: nunca se buscan ciclos de más de 3 (RN-05).
   */
  async findCycles(fromHomeId: string, toHomeId: string): Promise<CycleHome[][]> {
    const x = sql`${fromHomeId}::uuid`;
    const y = sql`${toHomeId}::uuid`;
    const rows = await this.db.execute<CandidateRow>(sql`
      SELECT third_id FROM (
        SELECT NULL::uuid AS third_id, NULL::timestamptz AS waiting
        FROM likes back
        JOIN homes hy ON hy.id = ${y}
        WHERE back.from_home_id = ${y} AND back.to_home_id = ${x}
          AND ${ownerActive('hy')}
        UNION ALL
        (SELECT l1.to_home_id, GREATEST(l1.created_at, l2.created_at)
         FROM likes l1
         JOIN likes l2 ON l2.from_home_id = l1.to_home_id AND l2.to_home_id = ${x}
         JOIN homes hz ON hz.id = l1.to_home_id
         JOIN homes hx ON hx.id = ${x}
         JOIN homes hy ON hy.id = ${y}
         WHERE l1.from_home_id = ${y}
           AND l1.to_home_id <> ${x}
           AND hz.status = 'published'
           AND hz.owner_id <> hx.owner_id
           AND hz.owner_id <> hy.owner_id
           AND ${ownerActive('hy')}
           AND ${ownerActive('hz')}
         ORDER BY 2, 1
         LIMIT ${MAX_CHAIN_CANDIDATES})
      ) candidates
      ORDER BY third_id IS NOT NULL, waiting, third_id`);
    const cycles = [...rows].map((row) => {
      const third = row.third_id ?? null;
      return third === null ? [fromHomeId, toHomeId] : [fromHomeId, toHomeId, third];
    });
    if (cycles.length === 0) return [];
    const members = await this.members([...new Set(cycles.flat())]);
    return cycles.flatMap((ids) => {
      const cycle = ids.map((id) => members.get(id));
      return cycle.every((member) => member !== undefined) ? [cycle] : [];
    });
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
