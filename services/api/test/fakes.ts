import { FIXTURE_PLACES, type HomeStatus } from '@changehouse/shared';

import type { AdminGrantRepository } from '../src/application/account/admin-grant.js';
import type { ConsentRepository } from '../src/application/account/consent-repository.js';
import type { HomeOwnership } from '../src/application/account/home-ownership.js';
import type { ProfileChanges, UserRepository } from '../src/application/account/user-repository.js';
import type {
  DecisionOrigin,
  DecisionStore,
  DecisionUnitOfWork,
  LastAction,
  MatchLookup,
} from '../src/application/decision/decision-repository.js';
import type {
  CandidateQuery,
  DiscoveryCandidate,
  DiscoveryRepository,
} from '../src/application/discovery/discovery-repository.js';
import type { HomeRepository, ModerationListing } from '../src/application/home/home-repository.js';
import type { PublicHome } from '../src/application/home/home-views.js';
import type { ImageProcessor, ProcessedImage } from '../src/application/home/image-processor.js';
import type { PhotoRepository } from '../src/application/home/photo-repository.js';
import type { OriginalFile, PhotoStorage } from '../src/application/home/photo-storage.js';
import type { PlaceResolver } from '../src/application/home/place-resolver.js';
import type {
  MatchScope,
  MatchUnitOfWork,
} from '../src/application/matching/match-unit-of-work.js';
import type {
  CycleCandidates,
  MatchDecisionStore,
  MatchHomeReader,
  MatchingTransaction,
  MatchListQuery,
  MatchReader,
  MatchRecord,
  MatchWriter,
  NewMatch,
} from '../src/application/matching/matching-repository.js';
import type { AuditEntry, AuditLog } from '../src/application/moderation/audit-log.js';
import type { ModerationScope, UnitOfWork } from '../src/application/moderation/unit-of-work.js';
import type {
  SuspensionScope,
  SuspensionUnitOfWork,
} from '../src/application/moderation/user-suspension.js';
import type {
  PreferencesScope,
  SearchPreferencesRepository,
} from '../src/application/search-preferences/search-preferences-repository.js';
import type { Consent } from '../src/domain/account/consent.js';
import type { User } from '../src/domain/account/user.js';
import { InvalidImageError } from '../src/domain/home/errors.js';
import type { Home, HomeLocation } from '../src/domain/home/home.js';
import { firstFreePosition, type HomePhoto, MAX_PHOTOS } from '../src/domain/home/photo.js';
import type { CompensationTerms, CycleHome } from '../src/domain/matching/cycle.js';
import type { MatchState } from '../src/domain/matching/match.js';
import type { SearchPreferences } from '../src/domain/search-preferences/search-preferences.js';

const DEFAULT_CREATED_AT = new Date('2026-10-01T09:00:00.000Z');

/** Usuario completo con valores por defecto; cada prueba cambia solo lo que le importa. */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    firebaseUid: 'uid-1',
    email: 'ana@example.com',
    displayName: 'Ana',
    phone: null,
    municipality: null,
    meetsVppRequirements: false,
    isOver65: false,
    assignedRole: null,
    suspendedAt: null,
    suspensionReason: null,
    createdAt: DEFAULT_CREATED_AT,
    ...overrides,
  };
}

/** Almacén en memoria de usuarios y consentimientos; reproduce la unicidad de uid y email. */
export class InMemoryUserRepository implements UserRepository, ConsentRepository {
  readonly users = new Map<string, User>();
  readonly consents: { userId: string; consent: Consent }[] = [];

  constructor(initial: readonly User[] = []) {
    for (const user of initial) this.users.set(user.id, user);
  }

  findByFirebaseUid(uid: string): Promise<User | null> {
    return Promise.resolve(
      [...this.users.values()].find((user) => user.firebaseUid === uid) ?? null,
    );
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  insertWithConsents(user: User, consents: readonly Consent[]): Promise<boolean> {
    const taken = [...this.users.values()].some(
      (other) =>
        other.firebaseUid === user.firebaseUid ||
        other.email.toLowerCase() === user.email.toLowerCase(),
    );
    if (taken) return Promise.resolve(false);
    this.users.set(user.id, user);
    for (const consent of consents) this.consents.push({ userId: user.id, consent });
    return Promise.resolve(true);
  }

  update(id: string, changes: ProfileChanges): Promise<User> {
    const current = this.users.get(id);
    if (!current) return Promise.reject(new Error(`Usuario inexistente: ${id}`));
    const updated = { ...current, ...changes };
    this.users.set(id, updated);
    return Promise.resolve(updated);
  }

  listByUser(userId: string): Promise<Consent[]> {
    return Promise.resolve(
      this.consents.filter((entry) => entry.userId === userId).map((entry) => entry.consent),
    );
  }

  add(userId: string, consent: Consent): Promise<Consent> {
    const existing = this.consents.find(
      (entry) =>
        entry.userId === userId &&
        entry.consent.type === consent.type &&
        entry.consent.version === consent.version,
    );
    if (existing) return Promise.resolve(existing.consent);
    this.consents.push({ userId, consent });
    return Promise.resolve(consent);
  }
}

/** Puerto de viviendas con un conjunto fijo de propietarios. */
export class FixedHomeOwnership implements HomeOwnership {
  constructor(readonly owners = new Set<string>()) {}

  hasPublishedHome(userId: string): Promise<boolean> {
    return Promise.resolve(this.owners.has(userId));
  }
}

/** Almacén en memoria de viviendas; conserva el orden de alta. */
export class InMemoryHomeRepository implements HomeRepository {
  readonly homes = new Map<string, Home>();

  insert(home: Home): Promise<void> {
    this.homes.set(home.id, home);
    return Promise.resolve();
  }

  save(home: Home): Promise<void> {
    if (!this.homes.has(home.id))
      return Promise.reject(new Error(`Vivienda inexistente: ${home.id}`));
    this.homes.set(home.id, home);
    return Promise.resolve();
  }

  findById(id: string): Promise<Home | null> {
    return Promise.resolve(this.homes.get(id) ?? null);
  }

  listByOwner(ownerId: string): Promise<Home[]> {
    return Promise.resolve([...this.homes.values()].filter((home) => home.ownerId === ownerId));
  }

  findByIdForUpdate(id: string): Promise<Home | null> {
    return this.findById(id);
  }

  markRelevantChange(id: string, at: Date): Promise<void> {
    const home = this.homes.get(id);
    if (home) this.homes.set(id, { ...home, relevantChangedAt: at });
    return Promise.resolve();
  }

  /** Misma ordenación que la real: la cola por envío ascendente; el resto, de la más reciente a la más antigua. */
  listForModeration(query: ModerationListing): Promise<Home[]> {
    const queue = query.status === 'in_review';
    const sign = queue ? 1 : -1;
    const at = (home: Home): number => (queue ? home.submittedAt : home.createdAt)?.getTime() ?? 0;
    const compare = (a: { at: number; id: string }, b: { at: number; id: string }): number =>
      sign * (a.at - b.at || a.id.localeCompare(b.id));
    const ordered = [...this.homes.values()]
      .filter((home) => query.status === undefined || home.status === query.status)
      .sort((a, b) => compare({ at: at(a), id: a.id }, { at: at(b), id: b.id }));
    const after = query.after;
    const rest = after
      ? ordered.filter(
          (home) =>
            compare({ at: at(home), id: home.id }, { at: after.at.getTime(), id: after.id }) > 0,
        )
      : ordered;
    return Promise.resolve(rest.slice(0, query.limit));
  }
}

/** Registro de auditoría en memoria; `failWith` simula un fallo al escribir. */
export class InMemoryAuditLog implements AuditLog {
  entries: AuditEntry[] = [];
  failWith: Error | null = null;

  record(entry: AuditEntry): Promise<void> {
    if (this.failWith) return Promise.reject(this.failWith);
    this.entries.push(entry);
    return Promise.resolve();
  }
}

/** Unidad de trabajo en memoria: si el trabajo falla, vuelve al estado anterior (como un `ROLLBACK`). */
export class InMemoryUnitOfWork implements UnitOfWork {
  constructor(
    private readonly homes: InMemoryHomeRepository,
    private readonly audit: InMemoryAuditLog,
  ) {}

  async run<T>(work: (scope: ModerationScope) => Promise<T>): Promise<T> {
    const homes = new Map(this.homes.homes);
    const entries = [...this.audit.entries];
    try {
      return await work({ homes: this.homes, audit: this.audit });
    } catch (error) {
      this.homes.homes.clear();
      for (const [id, home] of homes) this.homes.homes.set(id, home);
      this.audit.entries = entries;
      throw error;
    }
  }
}

/** Concesión del rol `admin` en memoria sobre los usuarios del repositorio de pruebas. */
export class InMemoryAdminGrants implements AdminGrantRepository {
  readonly activeHomeOwners = new Set<string>();

  constructor(private readonly users: InMemoryUserRepository) {}

  findByEmail(email: string): Promise<User | null> {
    return Promise.resolve(
      [...this.users.users.values()].find(
        (user) => user.email.toLowerCase() === email.toLowerCase(),
      ) ?? null,
    );
  }

  hasActiveHomes(userId: string): Promise<boolean> {
    return Promise.resolve(this.activeHomeOwners.has(userId));
  }

  assignAdmin(userId: string): Promise<void> {
    const user = this.users.users.get(userId);
    if (!user) return Promise.reject(new Error(`Usuario inexistente: ${userId}`));
    this.users.users.set(userId, { ...user, assignedRole: 'admin' });
    return Promise.resolve();
  }
}

/** Resolutor de direcciones de prueba para los casos de uso: el catálogo de lugares compartido con la app. */
export class CatalogPlaceResolver implements PlaceResolver {
  resolve(placeId: string): Promise<HomeLocation | null> {
    const place = FIXTURE_PLACES.find((candidate) => candidate.placeId === placeId);
    return Promise.resolve(
      place ? { exact: place.exact, areaName: place.areaName, areaCenter: place.areaCenter } : null,
    );
  }
}

/** Almacén en memoria de fotos; `markReady` reproduce la primera posición libre y el tope de 20. */
export class InMemoryPhotoRepository implements PhotoRepository {
  readonly photos = new Map<string, HomePhoto>();

  insertPending(photo: HomePhoto): Promise<void> {
    this.photos.set(photo.id, photo);
    return Promise.resolve();
  }

  find(homeId: string, photoId: string): Promise<HomePhoto | null> {
    const photo = this.photos.get(photoId);
    return Promise.resolve(photo?.homeId === homeId ? photo : null);
  }

  listReady(homeId: string): Promise<HomePhoto[]> {
    return this.listReadyByHomes([homeId]);
  }

  listReadyByHomes(homeIds: readonly string[]): Promise<HomePhoto[]> {
    const ready = [...this.photos.values()].filter(
      (photo) => photo.status === 'ready' && homeIds.includes(photo.homeId),
    );
    return Promise.resolve(ready.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
  }

  countReady(homeId: string): Promise<number> {
    return this.listReady(homeId).then((ready) => ready.length);
  }

  async markReady(homeId: string, photoId: string): Promise<HomePhoto | null> {
    const photo = await this.find(homeId, photoId);
    if (!photo) throw new Error(`Foto inexistente: ${photoId}`);
    const taken = (await this.listReady(homeId)).map((ready) => ready.position ?? 0);
    const position = taken.length >= MAX_PHOTOS ? null : firstFreePosition(taken);
    if (position === null) return null;
    const ready: HomePhoto = { ...photo, status: 'ready', position };
    this.photos.set(photoId, ready);
    return ready;
  }

  delete(homeId: string, photoId: string): Promise<void> {
    if (this.photos.get(photoId)?.homeId === homeId) this.photos.delete(photoId);
    return Promise.resolve();
  }
}

/** Almacenamiento de objetos en memoria con un espacio privado (originales) y otro público (procesadas). */
export class InMemoryPhotoStorage implements PhotoStorage {
  readonly originals = new Map<string, Buffer>();
  readonly published = new Map<string, { data: Buffer; contentType: string }>();
  readonly uploadUrls: { path: string; contentType: string; expiresAt: Date }[] = [];

  createUploadUrl(path: string, contentType: string, expiresAt: Date): Promise<string> {
    this.uploadUrls.push({ path, contentType, expiresAt });
    return Promise.resolve(`https://storage.test/upload/${path}`);
  }

  readOriginal(path: string, maxBytes: number): Promise<OriginalFile> {
    const data = this.originals.get(path);
    if (!data) return Promise.resolve({ status: 'missing' });
    return Promise.resolve(
      data.length > maxBytes ? { status: 'too_large' } : { status: 'found', data },
    );
  }

  publish(path: string, data: Buffer, contentType: string): Promise<void> {
    this.published.set(path, { data, contentType });
    return Promise.resolve();
  }

  deleteOriginal(path: string): Promise<void> {
    this.originals.delete(path);
    return Promise.resolve();
  }

  deletePublished(path: string): Promise<void> {
    this.published.delete(path);
    return Promise.resolve();
  }

  publicUrl(path: string): string {
    return `https://cdn.test/${path}`;
  }
}

/** Procesador de pruebas: solo da por buenos los ficheros que empiezan por `IMG:` y los devuelve marcados. */
export class StubImageProcessor implements ImageProcessor {
  readonly received: Buffer[] = [];

  process(original: Buffer): Promise<ProcessedImage> {
    this.received.push(original);
    if (!original.toString('utf8').startsWith('IMG:'))
      return Promise.reject(new InvalidImageError());
    return Promise.resolve({
      data: Buffer.from(`WEBP:${original.toString('utf8')}`),
      contentType: 'image/webp',
      width: 2048,
      height: 1536,
    });
  }
}

/** Almacén en memoria de preferencias: una fila por ámbito (usuario o vivienda), como los índices únicos. */
export class InMemorySearchPreferencesRepository implements SearchPreferencesRepository {
  readonly rows: { id: string; scope: PreferencesScope; preferences: SearchPreferences }[] = [];

  private indexOf(scope: PreferencesScope): number {
    return this.rows.findIndex((row) =>
      scope.homeId === null
        ? row.scope.homeId === null && row.scope.userId === scope.userId
        : row.scope.homeId === scope.homeId,
    );
  }

  find(scope: PreferencesScope): Promise<SearchPreferences | null> {
    return Promise.resolve(this.rows[this.indexOf(scope)]?.preferences ?? null);
  }

  upsert(scope: PreferencesScope, id: string, preferences: SearchPreferences) {
    const index = this.indexOf(scope);
    const current = this.rows[index];
    if (current) this.rows[index] = { ...current, preferences };
    else this.rows.push({ id, scope, preferences });
    return Promise.resolve(preferences);
  }

  deleteForHome(homeId: string): Promise<boolean> {
    const index = this.indexOf({ userId: '', homeId });
    if (index < 0) return Promise.resolve(false);
    this.rows.splice(index, 1);
    return Promise.resolve(true);
  }
}

/** Orden de las tarjetas: de la publicada más recientemente a la más antigua; el id desempata. */
function newestFirst(a: DiscoveryCandidate, b: DiscoveryCandidate): number {
  return b.publishedAt.getTime() - a.publishedAt.getTime() || b.home.id.localeCompare(a.home.id);
}

/**
 * Fase 1 del descubrimiento en memoria: no filtra por zona ni preferencias (eso lo prueba la
 * integración con PostgreSQL); reproduce el orden, el cursor y el límite, y anota cada consulta.
 */
export class InMemoryDiscoveryRepository implements DiscoveryRepository {
  readonly candidates: DiscoveryCandidate[] = [];
  readonly queries: CandidateQuery[] = [];

  findCandidates(query: CandidateQuery): Promise<DiscoveryCandidate[]> {
    this.queries.push(query);
    const { after } = query;
    const ordered = [...this.candidates].sort(newestFirst);
    const rest = after
      ? ordered.filter(
          (candidate) =>
            candidate.publishedAt.getTime() < after.at.getTime() ||
            (candidate.publishedAt.getTime() === after.at.getTime() &&
              candidate.home.id.localeCompare(after.id) < 0),
        )
      : ordered;
    return Promise.resolve(rest.slice(0, query.limit));
  }
}

/** Decisiones en memoria: me gusta y descartes por origen, con el mismo orden y unicidad que la base de datos. */
export class InMemoryDecisionStore implements DecisionStore {
  readonly likes: { from: string; to: string; at: Date }[] = [];
  readonly dismissals: { origin: string; to: string; at: Date }[] = [];
  readonly locks: string[] = [];
  readonly pairLocks: string[] = [];
  /** Orden de los bloqueos y de la escritura del me gusta, para comprobar que se bloquea antes. */
  readonly lockOrder: ('user' | 'pair' | 'insert')[] = [];

  constructor(private readonly homes: InMemoryHomeRepository) {}

  private static key(origin: DecisionOrigin): string {
    return origin.kind === 'home' ? `home:${origin.homeId}` : `account:${origin.userId}`;
  }

  lockUser(userId: string): Promise<void> {
    this.locks.push(userId);
    this.lockOrder.push('user');
    return Promise.resolve();
  }

  lockPair(pairKey: string): Promise<void> {
    this.pairLocks.push(pairKey);
    this.lockOrder.push('pair');
    return Promise.resolve();
  }

  countLikes(userId: string, start: Date, end: Date): Promise<number> {
    const count = this.likes.filter(
      (like) =>
        this.homes.homes.get(like.from)?.ownerId === userId && like.at >= start && like.at < end,
    ).length;
    return Promise.resolve(count);
  }

  likeExists(from: string, to: string): Promise<boolean> {
    return Promise.resolve(this.likes.some((like) => like.from === from && like.to === to));
  }

  insertLike(from: string, to: string, at: Date): Promise<void> {
    this.likes.push({ from, to, at });
    this.lockOrder.push('insert');
    return Promise.resolve();
  }

  deleteLike(from: string, to: string): Promise<void> {
    const index = this.likes.findIndex((like) => like.from === from && like.to === to);
    if (index >= 0) this.likes.splice(index, 1);
    return Promise.resolve();
  }

  saveDismissal(origin: DecisionOrigin, to: string, at: Date): Promise<void> {
    const key = InMemoryDecisionStore.key(origin);
    const current = this.dismissals.find((row) => row.origin === key && row.to === to);
    if (current) current.at = at;
    else this.dismissals.push({ origin: key, to, at });
    return Promise.resolve();
  }

  deleteDismissal(origin: DecisionOrigin, to: string): Promise<void> {
    const key = InMemoryDecisionStore.key(origin);
    const index = this.dismissals.findIndex((row) => row.origin === key && row.to === to);
    if (index >= 0) this.dismissals.splice(index, 1);
    return Promise.resolve();
  }

  lastAction(origin: DecisionOrigin): Promise<LastAction | null> {
    const key = InMemoryDecisionStore.key(origin);
    const actions: LastAction[] = [
      ...(origin.kind === 'home'
        ? this.likes
            .filter((like) => like.from === origin.homeId)
            .map((like) => ({ kind: 'like' as const, targetHomeId: like.to, at: like.at }))
        : []),
      ...this.dismissals
        .filter((row) => row.origin === key)
        .map((row) => ({ kind: 'dismissal' as const, targetHomeId: row.to, at: row.at })),
    ];
    const newest = actions.sort((a, b) => b.at.getTime() - a.at.getTime())[0];
    return Promise.resolve(newest ?? null);
  }
}

/** Unidad de trabajo de decisiones en memoria: si el trabajo falla, vuelve al estado anterior. */
export class InMemoryDecisionUnitOfWork implements DecisionUnitOfWork {
  constructor(
    readonly store: InMemoryDecisionStore,
    readonly matching: InMemoryMatchStore,
  ) {}

  async run<T>(
    work: (store: DecisionStore, matching: MatchingTransaction) => Promise<T>,
  ): Promise<T> {
    const likes = this.store.likes.map((like) => ({ ...like }));
    const dismissals = this.store.dismissals.map((row) => ({ ...row }));
    const records = [...this.matching.records];
    const saved = [...this.matching.saved];
    try {
      return await work(this.store, { cycles: this.matching, matches: this.matching });
    } catch (error) {
      this.store.likes.splice(0, this.store.likes.length, ...likes);
      this.store.dismissals.splice(0, this.store.dismissals.length, ...dismissals);
      this.matching.records.splice(0, this.matching.records.length, ...records);
      this.matching.saved.splice(0, this.matching.saved.length, ...saved);
      throw error;
    }
  }
}

/**
 * Matches en memoria: busca los ciclos de 2 y 3 en los me gusta del almacén de decisiones y guarda
 * los matches con su clave única. `statusInTransaction` simula un cambio de estado que solo se ve
 * ya dentro de la transacción; `terms`, las preferencias efectivas de cada vivienda.
 */
export class InMemoryMatchStore implements CycleCandidates, MatchWriter {
  readonly terms = new Map<string, CompensationTerms>();
  readonly displayNames = new Map<string, string>();
  readonly statusInTransaction = new Map<string, HomeStatus>();
  readonly records: MatchRecord[] = [];
  /** Clave de ciclo → id del match: la restricción única. */
  private readonly keys = new Map<string, string>();
  readonly saved: NewMatch[] = [];
  failOnFind = false;

  constructor(
    private readonly decisions: InMemoryDecisionStore,
    private readonly homes: InMemoryHomeRepository,
  ) {}

  private member(homeId: string): CycleHome {
    const home = this.homes.homes.get(homeId);
    if (!home) throw new Error(`Vivienda ${homeId} inexistente`);
    return {
      homeId,
      ownerId: home.ownerId,
      status: this.statusInTransaction.get(homeId) ?? home.status,
      valueMinCents: home.valueMinCents,
      valueMaxCents: home.valueMaxCents,
      terms: this.terms.get(homeId) ?? null,
    };
  }

  /**
   * Como el adaptador: primero el ciclo de 2 y después los de 3 con una tercera vivienda publicada
   * de otro propietario, del que lleva más tiempo esperando (su me gusta más reciente, el más
   * antiguo) al que menos.
   */
  findCycles(fromHomeId: string, toHomeId: string): Promise<CycleHome[][]> {
    const likeAt = (from: string, to: string) =>
      this.decisions.likes.find((like) => like.from === from && like.to === to)?.at;
    const direct =
      likeAt(toHomeId, fromHomeId) === undefined
        ? []
        : [[this.member(fromHomeId), this.member(toHomeId)]];
    const owners = new Set([fromHomeId, toHomeId].map((id) => this.member(id).ownerId));
    const chains = this.decisions.likes
      .filter((like) => like.from === toHomeId && ![fromHomeId, toHomeId].includes(like.to))
      .flatMap((like) => {
        const back = likeAt(like.to, fromHomeId);
        const third = this.member(like.to);
        if (back === undefined || third.status !== 'published' || owners.has(third.ownerId)) {
          return [];
        }
        return [{ third, waiting: Math.max(like.at.getTime(), back.getTime()) }];
      })
      .sort((a, b) => a.waiting - b.waiting || a.third.homeId.localeCompare(b.third.homeId))
      .map(({ third }) => [this.member(fromHomeId), this.member(toHomeId), third]);
    return Promise.resolve([...direct, ...chains]);
  }

  saveMatch(match: NewMatch): Promise<string> {
    const existing = this.keys.get(match.cycle.cycleKey);
    if (existing !== undefined && this.records.some((record) => record.id === existing)) {
      return Promise.resolve(existing);
    }
    this.saved.push(match);
    this.keys.set(match.cycle.cycleKey, match.id);
    this.records.push({
      id: match.id,
      type: match.cycle.type,
      status: 'open',
      createdAt: match.createdAt,
      participants: [...match.cycle.participants]
        .sort((a, b) => a.homeId.localeCompare(b.homeId))
        .map((participant) => ({
          ...participant,
          displayName: this.displayNames.get(participant.userId) ?? participant.userId,
          status: 'pending' as const,
        })),
    });
    return Promise.resolve(match.id);
  }

  findMatch(id: string): Promise<MatchRecord | null> {
    if (this.failOnFind) return Promise.reject(new Error('fallo al leer el match'));
    return Promise.resolve(this.records.find((record) => record.id === id) ?? null);
  }
}

/** Lectura de matches en memoria: los del usuario, del más reciente al más antiguo, tras el cursor. */
export class InMemoryMatchReader implements MatchReader {
  readonly queries: MatchListQuery[] = [];
  /** Teléfono del perfil de cada usuario. */
  readonly phones = new Map<string, string>();
  /** Autorizaciones de teléfono, como `matchId|userId`. */
  readonly sharing = new Set<string>();

  constructor(readonly records: MatchRecord[] = []) {}

  listForUser(query: MatchListQuery): Promise<MatchRecord[]> {
    this.queries.push(query);
    const position = (record: MatchRecord) => `${record.createdAt.toISOString()}|${record.id}`;
    const after = query.after && `${query.after.at.toISOString()}|${query.after.id}`;
    const found = this.records
      .filter((record) => record.participants.some((p) => p.userId === query.userId))
      .filter((record) => query.status === undefined || record.status === query.status)
      .filter((record) => after === undefined || position(record) < after)
      .sort((a, b) => position(b).localeCompare(position(a)))
      .slice(0, query.limit);
    return Promise.resolve(found);
  }

  findById(id: string): Promise<MatchRecord | null> {
    return Promise.resolve(this.records.find((record) => record.id === id) ?? null);
  }

  phoneSharing(matchId: string): Promise<ReadonlySet<string>> {
    const prefix = `${matchId}|`;
    return Promise.resolve(
      new Set(
        [...this.sharing]
          .filter((key) => key.startsWith(prefix))
          .map((k) => k.slice(prefix.length)),
      ),
    );
  }

  sharedPhones(matchId: string): Promise<ReadonlyMap<string, string>> {
    const shared = new Map<string, string>();
    for (const [userId, phone] of this.phones) {
      if (this.sharing.has(`${matchId}|${userId}`)) shared.set(userId, phone);
    }
    return Promise.resolve(shared);
  }
}

/** Viviendas de un match en memoria; `decrypted` anota cada dirección exacta pedida (el «descifrado»). */
export class InMemoryMatchHomes implements MatchHomeReader {
  readonly decrypted: string[] = [];
  publicReads = 0;

  constructor(private readonly homes: InMemoryHomeRepository) {}

  findPublicHomes(homeIds: readonly string[]): Promise<PublicHome[]> {
    this.publicReads += 1;
    return Promise.resolve(
      homeIds.flatMap((id) => {
        const home = this.homes.homes.get(id);
        return home ? [home] : [];
      }),
    );
  }

  exactAddresses(homeIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    this.decrypted.push(...homeIds);
    const addresses = new Map<string, string>();
    for (const id of homeIds) {
      const home = this.homes.homes.get(id);
      if (home) addresses.set(id, home.address);
    }
    return Promise.resolve(addresses);
  }
}

/**
 * Transacción de matches en memoria sobre el lector: si el trabajo falla, vuelve al estado anterior
 * (como un `ROLLBACK`). `locked` anota los matches leídos con bloqueo.
 */
export class InMemoryMatchUnitOfWork implements MatchUnitOfWork, MatchDecisionStore {
  readonly locked: string[] = [];
  readonly saved: { id: string; state: MatchState }[] = [];

  constructor(
    private readonly reader: InMemoryMatchReader,
    readonly audit: InMemoryAuditLog,
  ) {}

  async run<T>(work: (scope: MatchScope) => Promise<T>): Promise<T> {
    const records = [...this.reader.records];
    const sharing = new Set(this.reader.sharing);
    const entries = [...this.audit.entries];
    try {
      return await work({ matches: this, audit: this.audit });
    } catch (error) {
      this.reader.records.splice(0, this.reader.records.length, ...records);
      this.reader.sharing.clear();
      for (const key of sharing) this.reader.sharing.add(key);
      this.audit.entries = entries;
      throw error;
    }
  }

  findForUpdate(id: string): Promise<MatchRecord | null> {
    this.locked.push(id);
    return this.reader.findById(id);
  }

  saveState(id: string, state: MatchState): Promise<void> {
    this.saved.push({ id, state });
    const index = this.reader.records.findIndex((record) => record.id === id);
    const current = this.reader.records[index];
    if (!current) return Promise.reject(new Error(`Match inexistente: ${id}`));
    this.reader.records[index] = {
      ...current,
      status: state.status,
      participants: current.participants.map((participant) => ({
        ...participant,
        status:
          state.participants.find((p) => p.homeId === participant.homeId)?.status ??
          participant.status,
      })),
    };
    return Promise.resolve();
  }

  setPhoneSharing(matchId: string, userId: string, share: boolean): Promise<void> {
    const key = `${matchId}|${userId}`;
    if (share) this.reader.sharing.add(key);
    else this.reader.sharing.delete(key);
    return Promise.resolve();
  }
}

/** Consulta de matches de pruebas: los me gusta indicados forman parte de un match. */
export class FakeMatchLookup implements MatchLookup {
  readonly inMatch = new Set<string>();

  isLikeInMatch(from: string, to: string): Promise<boolean> {
    return Promise.resolve(this.inMatch.has(`${from}>${to}`));
  }
}

/**
 * Transacción de suspensión en memoria sobre los usuarios y los matches: si el trabajo falla, vuelve
 * al estado anterior (como un `ROLLBACK`). `locked` anota los usuarios cuyos matches se bloquearon.
 */
export class InMemorySuspensionUnitOfWork implements SuspensionUnitOfWork {
  readonly locked: string[] = [];

  constructor(
    private readonly users: InMemoryUserRepository,
    private readonly reader: InMemoryMatchReader,
    private readonly audit: InMemoryAuditLog,
  ) {}

  async run<T>(work: (scope: SuspensionScope) => Promise<T>): Promise<T> {
    const users = new Map(this.users.users);
    const records = [...this.reader.records];
    const entries = [...this.audit.entries];
    const matchUnit = new InMemoryMatchUnitOfWork(this.reader, this.audit);
    try {
      return await work({
        users: {
          findForUpdate: (id) => this.users.findById(id),
          saveSuspension: (user) => {
            this.users.users.set(user.id, user);
            return Promise.resolve();
          },
        },
        matches: {
          findActiveForUpdate: (userId) => {
            this.locked.push(userId);
            return Promise.resolve(
              this.reader.records.filter(
                (record) =>
                  (record.status === 'open' || record.status === 'confirmed') &&
                  record.participants.some((participant) => participant.userId === userId),
              ),
            );
          },
          saveState: (id, state) => matchUnit.saveState(id, state),
        },
        audit: this.audit,
      });
    } catch (error) {
      this.users.users.clear();
      for (const [id, user] of users) this.users.users.set(id, user);
      this.reader.records.splice(0, this.reader.records.length, ...records);
      this.audit.entries = entries;
      throw error;
    }
  }
}
