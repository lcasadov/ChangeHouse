import type { components } from '../api/schema';
import { json, problem } from './http-responses';

export type Match = components['schemas']['Match'];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const DEFAULT_COMPENSATION_CENTS = 1_200_000;
const DEFAULT_CREATED_AT = '2026-10-19T10:00:00.000Z';
const ONE_MINUTE_MS = 60_000;

let sequence = 0;

export interface FakeMatchOptions {
  id?: string;
  /** Mi vivienda: la que entrego. */
  mineHomeId: string;
  /** La vivienda del otro: la que recibo. */
  theirHomeId: string;
  /** Lo que me corresponde: positivo si pago, negativo si recibo. */
  compensationCents?: number;
  createdAt?: string;
  status?: Match['status'];
  type?: Match['type'];
  theirName?: string;
}

/** Un match entre dos viviendas con la forma de la lista (`listMyMatches`): sin teléfono ni dirección. */
export function fakeMatch({
  id,
  mineHomeId,
  theirHomeId,
  compensationCents = DEFAULT_COMPENSATION_CENTS,
  createdAt = DEFAULT_CREATED_AT,
  status = 'open',
  type = 2,
  theirName = 'Beto',
}: FakeMatchOptions): Match {
  sequence += 1;
  return {
    id: id ?? `0198f3a0-cccc-7000-8000-${String(sequence).padStart(12, '0')}`,
    type,
    status,
    createdAt,
    participants: [
      {
        homeId: mineHomeId,
        displayName: 'Ana',
        givesHomeId: mineHomeId,
        receivesHomeId: theirHomeId,
        compensationCents,
        status: 'pending',
      },
      {
        homeId: theirHomeId,
        displayName: theirName,
        givesHomeId: theirHomeId,
        receivesHomeId: mineHomeId,
        compensationCents: -compensationCents,
        status: 'pending',
      },
    ],
  };
}

/**
 * Los matches del usuario con las reglas de `listMyMatches`: del más reciente al más antiguo,
 * filtro por estado y paginación por cursor opaco (una posición en la lista filtrada). También
 * decide qué «Me gusta» cierran un match (`closeOnLike`), para que `likeHome` lo devuelva.
 */
export class FakeMatches {
  private readonly items: Match[];
  private readonly closing = new Map<string, number>();
  private rejection: number | null = null;
  pageSize = DEFAULT_PAGE_SIZE;

  constructor(
    seed: readonly Match[],
    private readonly roles: () => readonly string[],
  ) {
    this.items = [...seed];
  }

  /** Los matches vigentes, del más reciente al más antiguo. */
  all(): readonly Match[] {
    return [...this.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** La siguiente consulta de la lista responde con este error. */
  rejectNext(status: number): void {
    this.rejection = status;
  }

  /** El «Me gusta» de `fromHomeId` a `targetHomeId` cierra un match con esa compensación para quien lo da. */
  closeOnLike(
    fromHomeId: string,
    targetHomeId: string,
    compensationCents = DEFAULT_COMPENSATION_CENTS,
  ): void {
    this.closing.set(`${fromHomeId}>${targetHomeId}`, compensationCents);
  }

  /** Crea el match si ese «Me gusta» estaba preparado para cerrarlo; si no, `null`. */
  formFor(fromHomeId: string, targetHomeId: string): Match | null {
    const key = `${fromHomeId}>${targetHomeId}`;
    const compensationCents = this.closing.get(key);
    if (compensationCents === undefined) return null;
    this.closing.delete(key);
    const match = fakeMatch({
      mineHomeId: fromHomeId,
      theirHomeId: targetHomeId,
      compensationCents,
      createdAt: this.nextCreatedAt(),
    });
    this.items.push(match);
    return match;
  }

  /** Un minuto después del match más reciente: determinista y siempre el primero de la lista. */
  private nextCreatedAt(): string {
    const latest = this.all()[0]?.createdAt ?? DEFAULT_CREATED_AT;
    return new Date(Date.parse(latest) + ONE_MINUTE_MS).toISOString();
  }

  respond(search: URLSearchParams): Response {
    const rejection = this.rejection;
    if (rejection !== null) {
      this.rejection = null;
      return problem(rejection);
    }
    const roles = this.roles();
    if (!roles.includes('owner') && !roles.includes('seeker')) return problem(403);
    const status = search.get('status');
    const available = this.all().filter((match) => status === null || match.status === status);
    const limit = Math.min(Number(search.get('limit') ?? this.pageSize), MAX_PAGE_SIZE);
    const start = Number(search.get('cursor') ?? 0);
    const end = start + limit;
    return json(200, {
      items: available.slice(start, end),
      nextCursor: end < available.length ? String(end) : null,
    });
  }
}
