import type { Role } from '../../domain/account/role.js';
import { MatchNotFoundError } from '../../domain/matching/errors.js';
import {
  confirmInterest,
  ensureCanSharePhone,
  ensureParticipant,
  isContactVisibleTo,
  type MatchStatus,
  withdrawFromMatch,
} from '../../domain/matching/match.js';
import type { Clock } from '../clock.js';
import { type HomePublicView, toHomePublicView, toPhotoViews } from '../home/home-views.js';
import type { PhotoRepository } from '../home/photo-repository.js';
import type { PhotoStorage } from '../home/photo-storage.js';
import type { IdGenerator } from '../id-generator.js';
import { encodeCursor, type ModerationCursor } from '../moderation/cursor.js';
import { MATCH_CLOSED, MATCH_CONFIRMED } from '../outbox/outbox.js';
import type { MatchUnitOfWork } from './match-unit-of-work.js';
import {
  type MatchDetailView,
  type MatchView,
  toMatchView,
  toParticipantView,
} from './match-views.js';
import type { MatchHomeReader, MatchReader, MatchRecord } from './matching-repository.js';

export interface MatchDeps {
  matches: MatchReader;
  homes: MatchHomeReader;
  photos: PhotoRepository;
  storage: Pick<PhotoStorage, 'publicUrl'>;
  units: MatchUnitOfWork;
  clock: Clock;
  ids: IdGenerator;
}

export interface MyMatchesQuery {
  status?: MatchStatus;
  after?: ModerationCursor;
  limit: number;
}

export interface MatchPage {
  items: MatchView[];
  nextCursor: string | null;
}

/** Quién consulta un match: su cuenta y su rol. */
export interface MatchViewer {
  userId: string;
  role: Role;
}

/**
 * Matches en los que participa alguna vivienda del usuario (RF-50), del más reciente al más
 * antiguo; nunca los ajenos. Un `seeker` (p. ej. con su vivienda pausada) también ve los suyos.
 */
async function listMyMatches(
  deps: MatchDeps,
  userId: string,
  query: MyMatchesQuery,
): Promise<MatchPage> {
  // Una más de las pedidas: si llega, hay otra página
  const found = await deps.matches.listForUser({
    userId,
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.after === undefined ? {} : { after: query.after }),
    limit: query.limit + 1,
  });
  const page = found.slice(0, query.limit);
  const last = page.at(-1);
  const nextCursor =
    found.length > query.limit && last ? encodeCursor({ at: last.createdAt, id: last.id }) : null;
  return { items: page.map(toMatchView), nextCursor };
}

/** Las viviendas del ciclo, en el orden de los participantes, con todas sus fotos listas. */
async function homesOf(deps: MatchDeps, match: MatchRecord): Promise<HomePublicView[]> {
  const homeIds = match.participants.map((participant) => participant.homeId);
  const [homes, ready] = await Promise.all([
    deps.homes.findPublicHomes(homeIds),
    deps.photos.listReadyByHomes(homeIds),
  ]);
  return homes
    .toSorted((a, b) => homeIds.indexOf(a.id) - homeIds.indexOf(b.id))
    .map((home) =>
      toHomePublicView(
        home,
        toPhotoViews(
          ready.filter((photo) => photo.homeId === home.id),
          (path) => deps.storage.publicUrl(path),
        ),
      ),
    );
}

/**
 * Detalle del match para sus participantes (con la dirección exacta de la vivienda que entrega cada
 * uno y el teléfono de quien lo ha autorizado, solo mientras el match está `open` o `confirmed` y
 * quien consulta no se ha retirado) y, sin ellos, para el `admin`. Para cualquier otro es
 * como si no existiera, y en ese caso no se lee ni se descifra nada de las viviendas (RN-08).
 */
async function getMatch(
  deps: MatchDeps,
  viewer: MatchViewer,
  matchId: string,
): Promise<MatchDetailView> {
  const match = await deps.matches.findById(matchId);
  const participates = match?.participants.some((p) => p.userId === viewer.userId) ?? false;
  if (!match || (!participates && viewer.role !== 'admin')) throw new MatchNotFoundError();

  const base = toMatchView(match);
  const homes = await homesOf(deps, match);
  if (!participates) return { ...base, homes };

  // Cerrado, o retirado el solicitante: ni se descifran direcciones ni se leen teléfonos
  if (!isContactVisibleTo(match, viewer.userId)) {
    return {
      ...base,
      homes,
      participants: match.participants.map((participant) => ({
        ...toParticipantView(participant),
        phone: null,
        sharesPhone: false,
      })),
    };
  }

  const [addresses, phones, sharing] = await Promise.all([
    deps.homes.exactAddresses(match.participants.map((participant) => participant.homeId)),
    deps.matches.sharedPhones(match.id),
    deps.matches.phoneSharing(match.id),
  ]);
  return {
    ...base,
    homes,
    participants: match.participants.map((participant) => ({
      ...toParticipantView(participant),
      exactAddress: addresses.get(participant.givesHomeId) ?? '',
      phone: phones.get(participant.userId) ?? null,
      sharesPhone: sharing.has(participant.userId),
    })),
  };
}

/** El participante confirma su interés; el último en confirmar lleva el match a `confirmed`. */
function confirmMatch(deps: MatchDeps, userId: string, matchId: string): Promise<MatchView> {
  return deps.units.run(async ({ matches, outbox }) => {
    const match = await matches.findForUpdate(matchId);
    if (!match) throw new MatchNotFoundError();
    const confirmed = confirmInterest(match, userId);
    // Confirmar de nuevo devuelve el mismo match: no hay nada que escribir
    if (confirmed !== match) await matches.saveState(matchId, confirmed);
    // El último en confirmar lleva el match a `confirmed`: el aviso sale con ese mismo cambio
    if (confirmed !== match && confirmed.status === 'confirmed') {
      await outbox.enqueue({
        id: deps.ids.next(),
        type: MATCH_CONFIRMED,
        aggregateId: matchId,
        at: deps.clock.now(),
      });
    }
    return toMatchView(confirmed);
  });
}

/** El participante se retira: el match se cierra para todos y la retirada queda auditada (RN-10). */
function withdrawFromMatchOf(deps: MatchDeps, userId: string, matchId: string): Promise<MatchView> {
  return deps.units.run(async ({ matches, audit, outbox }) => {
    const match = await matches.findForUpdate(matchId);
    if (!match) throw new MatchNotFoundError();
    const closed = withdrawFromMatch(match, userId);
    await matches.saveState(matchId, closed);
    await audit.record({
      actorId: userId,
      action: 'match.withdraw',
      entity: 'match',
      entityId: matchId,
      at: deps.clock.now(),
    });
    await outbox.enqueue({
      id: deps.ids.next(),
      type: MATCH_CLOSED,
      aggregateId: matchId,
      at: deps.clock.now(),
    });
    return toMatchView(closed);
  });
}

/** Autoriza o revoca mostrar el teléfono del participante a los demás (RF-53); solo su propia fila. */
function setPhoneSharing(
  deps: MatchDeps,
  userId: string,
  matchId: string,
  share: boolean,
): Promise<void> {
  return deps.units.run(async ({ matches }) => {
    const match = await matches.findForUpdate(matchId);
    if (!match) throw new MatchNotFoundError();
    // Revocar se admite en cualquier estado; autorizar solo con el match vivo
    if (share) ensureCanSharePhone(match, userId);
    else ensureParticipant(match, userId);
    await matches.setPhoneSharing(matchId, userId, share);
  });
}

/** Los casos de uso de los matches con sus dependencias ya inyectadas, listos para el transporte. */
export function matchOperations(deps: MatchDeps) {
  return {
    listMyMatches: (userId: string, query: MyMatchesQuery) => listMyMatches(deps, userId, query),
    getMatch: (viewer: MatchViewer, matchId: string) => getMatch(deps, viewer, matchId),
    confirmMatch: (userId: string, matchId: string) => confirmMatch(deps, userId, matchId),
    withdrawFromMatch: (userId: string, matchId: string) =>
      withdrawFromMatchOf(deps, userId, matchId),
    setPhoneSharing: (userId: string, matchId: string, share: boolean) =>
      setPhoneSharing(deps, userId, matchId, share),
  };
}
