import type { Home } from '../../domain/home/home.js';
import {
  type Compensation,
  evaluateExchange,
  type ExchangeSide,
} from '../../domain/matching/compensation.js';
import type { SearchPreferences } from '../../domain/search-preferences/search-preferences.js';
import type { UserRepository } from '../account/user-repository.js';
import { HomeNotFoundError } from '../home/errors.js';
import type { HomeRepository } from '../home/home-repository.js';
import {
  type HomePublicView,
  type PublicHome,
  toHomePublicView,
  toPhotoViews,
} from '../home/home-views.js';
import type { PhotoRepository } from '../home/photo-repository.js';
import type { PhotoStorage } from '../home/photo-storage.js';
import { encodeCursor } from '../moderation/cursor.js';
import type { EffectivePreferences } from '../search-preferences/search-preferences-operations.js';
import type { SearchPreferencesRepository } from '../search-preferences/search-preferences-repository.js';
import type {
  CandidateQuery,
  DiscoveryCandidate,
  DiscoveryPosition,
  DiscoveryRepository,
  OwnerTerms,
} from './discovery-repository.js';
import { HomeIdRequiredError, SearchPreferencesRequiredError } from './errors.js';

export interface DiscoveryDeps {
  homes: HomeRepository;
  users: Pick<UserRepository, 'findById'>;
  /** Para las preferencias por defecto del usuario en modo `seeker`. */
  preferences: SearchPreferencesRepository;
  /** Las de la vivienda si las tiene; si no, las de su propietario (`resolveEffectivePreferences`). */
  effectivePreferences: (homeId: string) => Promise<EffectivePreferences | null>;
  candidates: DiscoveryRepository;
  photos: PhotoRepository;
  storage: Pick<PhotoStorage, 'publicUrl'>;
}

export interface DiscoverQuery {
  /** Vivienda propia y publicada desde la que se busca. */
  homeId?: string | undefined;
  after?: DiscoveryPosition | undefined;
  limit: number;
}

/** `DiscoveryCard` del contrato: la forma pública más la compensación (`null` en modo `seeker`). */
export interface DiscoveryCardView extends HomePublicView {
  compensation: Compensation | null;
}

export interface DiscoveryPage {
  items: DiscoveryCardView[];
  nextCursor: string | null;
}

/** Candidatas que se piden en la fase 1 por cada tarjeta, cuando la economía puede descartarlas. */
const OVERSAMPLING = 3;
/**
 * Veces que se repite la fase 1 en una petición. Si se agotan sin llenar la página, se devuelve lo
 * encontrado con un cursor para seguir: el coste de una petición queda acotado.
 */
const MAX_SCAN_ROUNDS = 5;

/** Desde dónde y con qué se busca; `mine` solo cuando se busca desde una vivienda propia. */
interface Search {
  origin: Home | null;
  preferences: SearchPreferences;
  mine: ExchangeSide | null;
}

interface Match {
  candidate: DiscoveryCandidate;
  compensation: Compensation | null;
}

interface Scan {
  matches: Match[];
  /** Última candidata examinada. */
  last: DiscoveryPosition | null;
  /** La fase 1 ya no tiene más candidatas. */
  exhausted: boolean;
}

/** Con `homeId`, esa vivienda si es propia y está publicada (si no, 404). Sin él, la única publicada. */
async function originOf(
  deps: DiscoveryDeps,
  userId: string,
  homeId: string | undefined,
): Promise<Home | null> {
  if (homeId !== undefined) {
    const home = await deps.homes.findById(homeId);
    if (home?.ownerId !== userId || home.status !== 'published') throw new HomeNotFoundError();
    return home;
  }
  const published = (await deps.homes.listByOwner(userId)).filter(
    (home) => home.status === 'published',
  );
  if (published.length > 1) throw new HomeIdRequiredError();
  return published[0] ?? null;
}

/** Las preferencias efectivas de la vivienda, o las por defecto del usuario en modo `seeker`. */
async function preferencesFor(
  deps: DiscoveryDeps,
  userId: string,
  origin: Home | null,
): Promise<SearchPreferences> {
  const preferences = origin
    ? (await deps.effectivePreferences(origin.id))?.preferences
    : await deps.preferences.find({ userId, homeId: null });
  if (!preferences) throw new SearchPreferencesRequiredError();
  return preferences;
}

/** Un lado del intercambio; `null` si a la vivienda le falta el rango de valor. */
function sideOf(
  home: Pick<PublicHome, 'valueMinCents' | 'valueMaxCents'>,
  terms: OwnerTerms,
): ExchangeSide | null {
  if (home.valueMinCents === null || home.valueMaxCents === null) return null;
  return {
    valueMinCents: home.valueMinCents,
    valueMaxCents: home.valueMaxCents,
    valueReferencePct: terms.valueReferencePct,
    maxToPayCents: terms.maxToPayCents,
    minToReceiveCents: terms.minToReceiveCents,
  };
}

/** Fase 2: la compatibilidad económica en los dos sentidos (RN-03); sin origen no hay economía. */
function matchOf(search: Search, candidate: DiscoveryCandidate): Match | null {
  if (search.origin === null) return { candidate, compensation: null };
  const theirs = candidate.ownerTerms && sideOf(candidate.home, candidate.ownerTerms);
  const compensation = search.mine && theirs ? evaluateExchange(search.mine, theirs) : null;
  return compensation ? { candidate, compensation } : null;
}

const positionOf = (candidate: DiscoveryCandidate): DiscoveryPosition => ({
  at: candidate.publishedAt,
  id: candidate.home.id,
});

/** Añade las compatibles de un lote hasta tener una más de las pedidas; devuelve la última examinada. */
function collect(
  search: Search,
  batch: readonly DiscoveryCandidate[],
  matches: Match[],
  limit: number,
): DiscoveryPosition | null {
  let last: DiscoveryPosition | null = null;
  for (const candidate of batch) {
    last = positionOf(candidate);
    const match = matchOf(search, candidate);
    if (match) matches.push(match);
    if (matches.length > limit) break;
  }
  return last;
}

/**
 * Repite la fase 1 con sobremuestreo hasta tener una tarjeta más de las pedidas (así se sabe si hay
 * otra página), agotar las candidatas o el número de rondas.
 */
async function scan(
  deps: DiscoveryDeps,
  query: Omit<CandidateQuery, 'after' | 'limit'>,
  search: Search,
  after: DiscoveryPosition | null,
  limit: number,
): Promise<Scan> {
  const batchSize = search.origin === null ? limit + 1 : (limit + 1) * OVERSAMPLING;
  const matches: Match[] = [];
  let last = after;
  let exhausted = false;
  for (let round = 0; round < MAX_SCAN_ROUNDS && matches.length <= limit && !exhausted; round++) {
    const batch = await deps.candidates.findCandidates({ ...query, after: last, limit: batchSize });
    exhausted = batch.length < batchSize;
    last = collect(search, batch, matches, limit) ?? last;
  }
  return { matches, last, exhausted };
}

/** Cursor de la página: tras su última tarjeta si hay más, tras lo examinado si se agotaron las rondas. */
function nextCursorOf(result: Scan, page: readonly Match[], limit: number): string | null {
  const lastCard = page.at(-1);
  if (result.matches.length > limit && lastCard)
    return encodeCursor(positionOf(lastCard.candidate));
  if (result.exhausted || result.last === null) return null;
  return encodeCursor(result.last);
}

async function cardsOf(deps: DiscoveryDeps, page: readonly Match[]): Promise<DiscoveryCardView[]> {
  const ready = await deps.photos.listReadyByHomes(page.map((match) => match.candidate.home.id));
  return page.map(({ candidate, compensation }) => ({
    ...toHomePublicView(
      candidate.home,
      toPhotoViews(
        ready.filter((photo) => photo.homeId === candidate.home.id),
        (path) => deps.storage.publicUrl(path),
      ),
    ),
    compensation,
  }));
}

/**
 * Tarjetas de descubrimiento (RF-40, RF-44, RN-06, RN-11). Desde una vivienda propia publicada:
 * fase 1 en el almacén (zona, filtros, exclusiones y compatibilidad inversa) y fase 2 en el
 * dominio (economía en los dos sentidos). Sin vivienda publicada (`seeker`), solo la fase 1 con
 * las preferencias por defecto, sin compatibilidad inversa ni compensación.
 */
async function discoverHomes(
  deps: DiscoveryDeps,
  userId: string,
  query: DiscoverQuery,
): Promise<DiscoveryPage> {
  const origin = await originOf(deps, userId, query.homeId);
  const preferences = await preferencesFor(deps, userId, origin);
  const user = await deps.users.findById(userId);
  const search: Search = { origin, preferences, mine: origin && sideOf(origin, preferences) };
  const candidateQuery = {
    viewerId: userId,
    preferences,
    includeVpp: user?.meetsVppRequirements ?? false,
    origin,
  };
  const result = await scan(deps, candidateQuery, search, query.after ?? null, query.limit);
  const page = result.matches.slice(0, query.limit);
  return { items: await cardsOf(deps, page), nextCursor: nextCursorOf(result, page, query.limit) };
}

/** Los casos de uso del descubrimiento con sus dependencias ya inyectadas, listos para el transporte. */
export function discoveryOperations(deps: DiscoveryDeps) {
  return {
    discoverHomes: (userId: string, query: DiscoverQuery) => discoverHomes(deps, userId, query),
  };
}
