import type { components } from '../api/schema';
import type { Me } from '../features/account/account-api';
import type { Home } from '../features/homes/homes-api';
import { discoveryCard } from './fake-discovery';
import { json, problem } from './http-responses';

export type Match = components['schemas']['Match'];
export type MatchDetail = components['schemas']['MatchDetail'];
type HomePublic = components['schemas']['HomePublic'];
type ParticipantStatus = components['schemas']['ParticipantStatus'];

const MATCH_PATH = /^\/matches\/([^/]+)(?:\/(confirm|withdraw|phone-sharing))?$/;
const NO_CONTENT = 204;

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
  /** Mi estado como participante (por defecto, `pending`). */
  mineStatus?: ParticipantStatus;
  /** El estado del otro participante (por defecto, `pending`). */
  theirStatus?: ParticipantStatus;
  /** El chat de Firestore del match; ausente mientras el chat no se ha creado. */
  chatId?: string;
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
  mineStatus = 'pending',
  theirStatus = 'pending',
  chatId,
}: FakeMatchOptions): Match {
  sequence += 1;
  return {
    id: id ?? `0198f3a0-cccc-7000-8000-${String(sequence).padStart(12, '0')}`,
    type,
    status,
    ...(chatId ? { chatId } : {}),
    createdAt,
    participants: [
      {
        homeId: mineHomeId,
        displayName: 'Ana',
        givesHomeId: mineHomeId,
        receivesHomeId: theirHomeId,
        compensationCents,
        status: mineStatus,
      },
      {
        homeId: theirHomeId,
        displayName: theirName,
        givesHomeId: theirHomeId,
        receivesHomeId: mineHomeId,
        compensationCents: -compensationCents,
        status: theirStatus,
      },
    ],
  };
}

export interface FakeChainMatchOptions {
  id?: string;
  /** Mi vivienda: la que entrego. */
  mineHomeId: string;
  /** La vivienda que recibo (la de B). */
  fromHomeId: string;
  /** La vivienda que recibe la mía (la de C), a quien entrego. */
  toHomeId: string;
  /** Lo que corresponde a [yo, B, C]; positivo si paga. Debe sumar 0 (RN-04). */
  compensationsCents?: readonly [number, number, number];
  createdAt?: string;
  status?: Match['status'];
  names?: readonly [string, string, string];
}

const DEFAULT_CHAIN_COMPENSATIONS = [600_000, -200_000, -400_000] as const;
const DEFAULT_CHAIN_NAMES = ['Ana', 'Beto', 'Carla'] as const;

/**
 * Un match en cadena de tres (`type` 3) con la forma de la API: yo (A) recibo la casa de B, B recibe
 * la de C y C recibe la mía. Los participantes van ordenados por identificador de vivienda, **no**
 * en el orden del ciclo: la app lo reconstruye con `givesHomeId` y `receivesHomeId`.
 */
export function fakeChainMatch({
  id,
  mineHomeId,
  fromHomeId,
  toHomeId,
  compensationsCents = DEFAULT_CHAIN_COMPENSATIONS,
  createdAt = DEFAULT_CREATED_AT,
  status = 'open',
  names = DEFAULT_CHAIN_NAMES,
}: FakeChainMatchOptions): Match {
  sequence += 1;
  const cycle = [
    { homeId: mineHomeId, receivesHomeId: fromHomeId },
    { homeId: fromHomeId, receivesHomeId: toHomeId },
    { homeId: toHomeId, receivesHomeId: mineHomeId },
  ];
  const participants = cycle
    .map(({ homeId, receivesHomeId }, index): Match['participants'][number] => ({
      homeId,
      displayName: names[index] ?? '',
      givesHomeId: homeId,
      receivesHomeId,
      compensationCents: compensationsCents[index] ?? 0,
      status: 'pending',
    }))
    .sort((a, b) => a.homeId.localeCompare(b.homeId));
  return {
    id: id ?? `0198f3a0-dddd-7000-8000-${String(sequence).padStart(12, '0')}`,
    type: 3,
    status,
    createdAt,
    participants,
  };
}

/** El detalle de un match en cadena tal como lo ve un participante: con las tres viviendas, sin teléfonos. */
export function fakeChainMatchDetail(options: FakeChainMatchOptions): MatchDetail {
  const match = fakeChainMatch(options);
  return {
    ...match,
    participants: match.participants.map((participant) => ({
      ...participant,
      exactAddress: `Calle de ${participant.displayName} 1, 28001 Madrid`,
      phone: null,
      sharesPhone: false,
    })),
    homes: match.participants.map((participant) => publicHomeOf(participant.givesHomeId)),
  };
}

/** La forma pública de una vivienda, con las fotos: lo que `getMatch` devuelve en `homes`. */
function publicHomeOf(id: string): HomePublic {
  const card: Partial<ReturnType<typeof discoveryCard>> = discoveryCard({ id });
  delete card.compensation;
  return card as HomePublic;
}

/** El detalle de un match (`getMatch`) tal como lo ve un participante: con viviendas, sin teléfonos. */
export function fakeMatchDetail(options: FakeMatchOptions): MatchDetail {
  const match = fakeMatch(options);
  return {
    ...match,
    participants: match.participants.map((participant) => ({
      ...participant,
      exactAddress: `Calle de ${participant.displayName} 1, 28001 Madrid`,
      phone: null,
      sharesPhone: false,
    })),
    homes: [publicHomeOf(options.mineHomeId), publicHomeOf(options.theirHomeId)],
  };
}

/** Lo que `FakeMatches` necesita saber del resto del backend simulado. */
export interface MatchesContext {
  profile: () => Me;
  ownHomes: () => readonly Home[];
  /** La forma pública de una vivienda ajena que se ofrece en el descubrimiento. */
  otherHome: (homeId: string) => HomePublic | undefined;
}

interface PreparedFailure {
  status: number;
  extra: Record<string, unknown>;
}

/**
 * Los matches del usuario con las reglas de `listMyMatches`: del más reciente al más antiguo,
 * filtro por estado y paginación por cursor opaco (una posición en la lista filtrada). También
 * decide qué «Me gusta» cierran un match (`closeOnLike`), para que `likeHome` lo devuelva.
 */
export class FakeMatches {
  private readonly items: Match[];
  private readonly closing = new Map<string, number>();
  private readonly closingChains = new Map<
    string,
    Omit<FakeChainMatchOptions, 'mineHomeId' | 'fromHomeId'>
  >();
  private rejection: number | null = null;
  private actionFailure: PreparedFailure | null = null;
  private readonly phones = new Map<string, string>();
  private readonly addresses = new Map<string, string>();
  /** Las viviendas cuyo participante ha autorizado mostrar su teléfono, por match. */
  private readonly sharing = new Set<string>();
  pageSize = DEFAULT_PAGE_SIZE;

  constructor(
    seed: readonly Match[],
    private readonly roles: () => readonly string[],
    private readonly context: MatchesContext,
  ) {
    // Las acciones cambian el estado del match: se parte de copias para no alterar lo sembrado
    this.items = seed.map((match) => ({
      ...match,
      participants: match.participants.map((participant) => ({ ...participant })),
    }));
  }

  /** El teléfono del perfil del participante que entrega esa vivienda. */
  setPhone(homeId: string, phone: string): void {
    this.phones.set(homeId, phone);
  }

  /** La dirección exacta de esa vivienda; por defecto, una derivada del identificador. */
  setAddress(homeId: string, address: string): void {
    this.addresses.set(homeId, address);
  }

  /** El participante de esa vivienda autoriza o revoca mostrar su teléfono en el match. */
  setSharing(matchId: string, homeId: string, share: boolean): void {
    const key = `${matchId}:${homeId}`;
    if (share) this.sharing.add(key);
    else this.sharing.delete(key);
  }

  /** La siguiente consulta del detalle o acción sobre un match responde con ese error. */
  rejectNextAction(status: number, extra: Record<string, unknown> = {}): void {
    this.actionFailure = { status, extra };
  }

  /** Otro participante se retira mientras tanto: el match queda cerrado sin que la app lo sepa. */
  closeBehindTheScenes(matchId: string): void {
    const match = this.items.find((candidate) => candidate.id === matchId);
    if (!match) return;
    match.status = 'closed';
    const other = match.participants.find((p) => !this.isMine(p.homeId));
    if (other) other.status = 'withdrawn';
  }

  /** El match con ese identificador, tal como está ahora. */
  find(matchId: string): Match | undefined {
    return this.items.find((candidate) => candidate.id === matchId);
  }

  private isMine(homeId: string): boolean {
    return this.context.ownHomes().some((home) => home.id === homeId);
  }

  private addressOf(homeId: string): string {
    const own = this.context.ownHomes().find((home) => home.id === homeId);
    return (
      own?.address ?? this.addresses.get(homeId) ?? `Calle de Prueba ${homeId.slice(-4)}, Madrid`
    );
  }

  private phoneOf(homeId: string): string | null {
    if (this.isMine(homeId)) return this.context.profile().phone ?? null;
    return this.phones.get(homeId) ?? null;
  }

  private publicHome(homeId: string): HomePublic | undefined {
    const own = this.context.ownHomes().find((home) => home.id === homeId);
    if (!own) return this.context.otherHome(homeId);
    return {
      id: own.id,
      type: own.type,
      regime: own.regime,
      usefulM2: own.usefulM2,
      builtM2: own.builtM2,
      bedrooms: own.bedrooms,
      bathrooms: own.bathrooms,
      valueMinCents: own.valueMinCents ?? 0,
      valueMaxCents: own.valueMaxCents ?? 0,
      vppMaxLegalPriceCents: own.vppMaxLegalPriceCents ?? null,
      location: own.location,
      photos: own.photos ?? [],
    };
  }

  private detailOf(match: Match): MatchDetail {
    const homes = match.participants
      .map((participant) => this.publicHome(participant.givesHomeId))
      .filter((home): home is HomePublic => home !== undefined);
    return {
      ...match,
      participants: match.participants.map((participant) => {
        const shares = this.sharing.has(`${match.id}:${participant.homeId}`);
        return {
          ...participant,
          exactAddress: this.addressOf(participant.givesHomeId),
          sharesPhone: shares,
          phone: shares ? this.phoneOf(participant.homeId) : null,
        };
      }),
      homes,
    };
  }

  /** `GET /matches/{id}`, `POST …/confirm`, `POST …/withdraw` y `PUT …/phone-sharing`. */
  respondToMatch(method: string, path: string, body: unknown): Response {
    const failure = this.actionFailure;
    if (failure) {
      this.actionFailure = null;
      return problem(failure.status, failure.extra);
    }
    const [, id, action] = MATCH_PATH.exec(path) ?? [];
    const match = this.items.find((candidate) => candidate.id === id);
    const mine = match?.participants.find((participant) => this.isMine(participant.homeId));
    if (!match || !mine) return problem(404);
    if (action === undefined)
      return method === 'GET' ? json(200, this.detailOf(match)) : problem(404);
    if (match.status !== 'open' && !(match.status === 'confirmed' && action !== 'confirm')) {
      return problem(409, { code: 'MATCH_NOT_OPEN' });
    }
    if (action === 'phone-sharing') {
      this.setSharing(match.id, mine.homeId, (body as { share: boolean }).share);
      return new Response(null, { status: NO_CONTENT });
    }
    if (action === 'withdraw') {
      mine.status = 'withdrawn';
      match.status = 'closed';
    } else {
      mine.status = 'confirmed';
      if (match.participants.every((participant) => participant.status === 'confirmed')) {
        match.status = 'confirmed';
      }
    }
    return json(200, match);
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

  /** El «Me gusta» de `fromHomeId` a `targetHomeId` cierra una cadena de tres cuya tercera casa es `toHomeId`. */
  closeChainOnLike(
    fromHomeId: string,
    targetHomeId: string,
    options: Pick<FakeChainMatchOptions, 'toHomeId' | 'compensationsCents' | 'names'>,
  ): void {
    this.closingChains.set(`${fromHomeId}>${targetHomeId}`, options);
  }

  /** Crea el match si ese «Me gusta» estaba preparado para cerrarlo; si no, `null`. */
  formFor(fromHomeId: string, targetHomeId: string): Match | null {
    const key = `${fromHomeId}>${targetHomeId}`;
    const chain = this.closingChains.get(key);
    if (chain) {
      this.closingChains.delete(key);
      const created = fakeChainMatch({
        ...chain,
        mineHomeId: fromHomeId,
        fromHomeId: targetHomeId,
        createdAt: this.nextCreatedAt(),
      });
      this.items.push(created);
      return created;
    }
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
