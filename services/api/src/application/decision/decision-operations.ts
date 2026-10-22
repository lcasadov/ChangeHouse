import { madridDay, secondsUntil } from '../../domain/decision/madrid-day.js';
import type { Home } from '../../domain/home/home.js';
import { cycleKey, evaluateCycle } from '../../domain/matching/cycle.js';
import type { Clock } from '../clock.js';
import { HomeNotFoundError } from '../home/errors.js';
import type { HomeRepository } from '../home/home-repository.js';
import type { IdGenerator } from '../id-generator.js';
import { type MatchView, toMatchView } from '../matching/match-views.js';
import type { MatchingTransaction } from '../matching/matching-repository.js';
import type {
  DecisionOrigin,
  DecisionStore,
  DecisionUnitOfWork,
  MatchLookup,
} from './decision-repository.js';
import {
  DailyLikeLimitError,
  HomeNotPublishedError,
  LikeExistsError,
  LikeInMatchError,
  NothingToUndoError,
  OriginHomeRequiredError,
} from './errors.js';

export interface DecisionDeps {
  homes: HomeRepository;
  units: DecisionUnitOfWork;
  matches: MatchLookup;
  clock: Clock;
  /** Identificadores de los matches que se crean. */
  ids: IdGenerator;
  /** Me gusta permitidos por usuario y día natural de Madrid (RF-45). */
  likesPerDay: number;
}

export interface LikeCommand {
  fromHomeId: string;
  targetHomeId: string;
}

export interface DismissCommand {
  /** Vivienda propia desde la que se descarta; sin ella, descarta un `seeker` desde su cuenta. */
  fromHomeId?: string | undefined;
  targetHomeId: string;
}

/** `LikeResult` del contrato: el match que ha formado este me gusta, o `null`. */
export interface LikeResult {
  liked: true;
  match: MatchView | null;
}

/** Una vivienda propia; la ajena y la inexistente son indistinguibles (404). */
async function ownedHome(deps: DecisionDeps, userId: string, homeId: string): Promise<Home> {
  const home = await deps.homes.findById(homeId);
  if (home?.ownerId !== userId) throw new HomeNotFoundError();
  return home;
}

/** La vivienda sobre la que se decide: publicada y ajena; si no, ni se sabe que existe (404). */
async function visibleTarget(deps: DecisionDeps, userId: string, homeId: string): Promise<void> {
  const target = await deps.homes.findById(homeId);
  if (!target || target.ownerId === userId || target.status !== 'published') {
    throw new HomeNotFoundError();
  }
}

/** Un `seeker` (sin vivienda publicada) decide desde su cuenta; con una publicada hay que decir cuál. */
async function accountOrRequireHome(
  deps: DecisionDeps,
  userId: string,
  field: 'fromHomeId' | 'homeId',
): Promise<DecisionOrigin> {
  const owned = await deps.homes.listByOwner(userId);
  if (owned.some((home) => home.status === 'published')) throw new OriginHomeRequiredError(field);
  return { kind: 'account', userId };
}

/**
 * Busca los ciclos que cierra la arista recién insertada y crea el match del primero que el dominio
 * acepta (publicación y RN-03 leídas dentro de la transacción). Si el ciclo ya tenía match, lo
 * devuelve sin crear otro.
 */
async function closeCycle(
  deps: DecisionDeps,
  matching: MatchingTransaction,
  command: LikeCommand,
  now: Date,
): Promise<MatchView | null> {
  const candidates = await matching.cycles.findCycles(command.fromHomeId, command.targetHomeId);
  for (const candidate of candidates) {
    const evaluation = evaluateCycle(candidate);
    if (!evaluation.accepted) continue;
    const id = await matching.matches.saveMatch({
      id: deps.ids.next(),
      createdAt: now,
      cycle: evaluation.match,
    });
    const saved = await matching.matches.findMatch(id);
    if (!saved) throw new Error(`El match ${id} no se encuentra tras guardarlo`);
    return toMatchView(saved);
  }
  return null;
}

/**
 * Registra un me gusta (RF-41, RN-01, RN-02) y, si cierra un ciclo compatible, el match (RF-50,
 * RN-03, RN-04). Valida origen y destino antes de abrir la transacción; dentro de ella, bajo el
 * bloqueo del usuario (límite diario) y el del par de viviendas (me gusta cruzados simultáneos),
 * comprueba el duplicado y el límite, inserta la arista y busca y crea el match.
 */
async function likeHome(
  deps: DecisionDeps,
  userId: string,
  command: LikeCommand,
): Promise<LikeResult> {
  const origin = await ownedHome(deps, userId, command.fromHomeId);
  if (origin.status !== 'published') throw new HomeNotPublishedError();
  await visibleTarget(deps, userId, command.targetHomeId);

  const match = await deps.units.run(async (store, matching) => {
    await store.lockUser(userId);
    await store.lockPair(cycleKey([command.fromHomeId, command.targetHomeId]));
    if (await store.likeExists(command.fromHomeId, command.targetHomeId)) {
      throw new LikeExistsError();
    }
    const now = deps.clock.now();
    const today = madridDay(now);
    if ((await store.countLikes(userId, today.start, today.end)) >= deps.likesPerDay) {
      throw new DailyLikeLimitError(secondsUntil(today.end, now));
    }
    await store.insertLike(command.fromHomeId, command.targetHomeId, now);
    return closeCycle(deps, matching, command, now);
  });
  return { liked: true, match };
}

/** Descarta una vivienda desde una vivienda propia publicada o, para un `seeker`, desde su cuenta. */
async function dismissHome(
  deps: DecisionDeps,
  userId: string,
  command: DismissCommand,
): Promise<void> {
  let origin: DecisionOrigin;
  if (command.fromHomeId === undefined) {
    origin = await accountOrRequireHome(deps, userId, 'fromHomeId');
  } else {
    const from = await ownedHome(deps, userId, command.fromHomeId);
    if (from.status !== 'published') throw new HomeNotFoundError();
    origin = { kind: 'home', homeId: from.id };
  }
  await visibleTarget(deps, userId, command.targetHomeId);
  await deps.units.run((store) =>
    store.saveDismissal(origin, command.targetHomeId, deps.clock.now()),
  );
}

async function undoIn(
  deps: DecisionDeps,
  store: DecisionStore,
  origin: DecisionOrigin,
): Promise<void> {
  const last = await store.lastAction(origin);
  if (last === null) throw new NothingToUndoError();
  if (last.kind === 'dismissal') {
    await store.deleteDismissal(origin, last.targetHomeId);
    return;
  }
  if (origin.kind !== 'home') throw new NothingToUndoError();
  // Bajo el bloqueo del par, el match que pudiera usar este me gusta ya está confirmado o no existe
  await store.lockPair(cycleKey([origin.homeId, last.targetHomeId]));
  if (await deps.matches.isLikeInMatch(origin.homeId, last.targetHomeId)) {
    throw new LikeInMatchError();
  }
  await store.deleteLike(origin.homeId, last.targetHomeId);
}

/**
 * Deshace lo último que se decidió desde esa vivienda (o desde la cuenta de un `seeker`): el me gusta
 * o el descarte más reciente. Un me gusta que ya forma parte de un match no se deshace.
 */
async function undoLastAction(
  deps: DecisionDeps,
  userId: string,
  homeId: string | undefined,
): Promise<void> {
  const origin: DecisionOrigin =
    homeId === undefined
      ? await accountOrRequireHome(deps, userId, 'homeId')
      : { kind: 'home', homeId: (await ownedHome(deps, userId, homeId)).id };
  await deps.units.run(async (store) => {
    await store.lockUser(userId);
    await undoIn(deps, store, origin);
  });
}

/** Los casos de uso de las decisiones con sus dependencias ya inyectadas, listos para el transporte. */
export function decisionOperations(deps: DecisionDeps) {
  return {
    likeHome: (userId: string, command: LikeCommand) => likeHome(deps, userId, command),
    dismissHome: (userId: string, command: DismissCommand) => dismissHome(deps, userId, command),
    undoLastAction: (userId: string, homeId: string | undefined) =>
      undoLastAction(deps, userId, homeId),
  };
}
