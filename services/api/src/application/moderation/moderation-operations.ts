import type { HomeStatus, ModerationInput } from '@changehouse/shared';

import { approveHome, type Home, rejectHome } from '../../domain/home/home.js';
import type { Clock } from '../clock.js';
import { HomeNotFoundError } from '../home/errors.js';
import type { HomeRepository } from '../home/home-repository.js';
import { type HomeView, toAdminHomeView, toPhotoViews } from '../home/home-views.js';
import type { PhotoRepository } from '../home/photo-repository.js';
import type { PhotoStorage } from '../home/photo-storage.js';
import type { AuditAction } from './audit-log.js';
import { encodeCursor, type ModerationCursor } from './cursor.js';
import type { UnitOfWork } from './unit-of-work.js';

export interface ModerationDeps {
  units: UnitOfWork;
  homes: HomeRepository;
  photos: PhotoRepository;
  storage: PhotoStorage;
  clock: Clock;
}

export interface AdminHomesQuery {
  status?: HomeStatus;
  cursor?: ModerationCursor | undefined;
  limit: number;
}

export interface AdminHomesPage {
  items: HomeView[];
  nextCursor: string | null;
}

/** La cola se ordena por envío; el resto de listados, por alta (igual que el repositorio). */
function sortKey(home: Home, status: HomeStatus | undefined): Date {
  return (status === 'in_review' ? home.submittedAt : null) ?? home.createdAt;
}

async function viewsOf(deps: ModerationDeps, homes: readonly Home[]): Promise<HomeView[]> {
  const ready = await deps.photos.listReadyByHomes(homes.map((home) => home.id));
  return homes.map((home) =>
    toAdminHomeView(
      home,
      toPhotoViews(
        ready.filter((photo) => photo.homeId === home.id),
        (path) => deps.storage.publicUrl(path),
      ),
    ),
  );
}

async function adminListHomes(
  deps: ModerationDeps,
  query: AdminHomesQuery,
): Promise<AdminHomesPage> {
  // Una más de las pedidas: si llega, hay otra página
  const found = await deps.homes.listForModeration({
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.cursor === undefined ? {} : { after: query.cursor }),
    limit: query.limit + 1,
  });
  const page = found.slice(0, query.limit);
  const last = page.at(-1);
  const nextCursor =
    found.length > query.limit && last
      ? encodeCursor({ at: sortKey(last, query.status), id: last.id })
      : null;
  return { items: await viewsOf(deps, page), nextCursor };
}

/**
 * Aprueba o rechaza una vivienda en revisión. La decisión y su entrada de auditoría se confirman
 * juntas: si la auditoría falla, la vivienda no cambia. La fila se bloquea para que dos admins no
 * moderen a la vez.
 */
async function adminModerateHome(
  deps: ModerationDeps,
  adminId: string,
  homeId: string,
  input: ModerationInput,
): Promise<HomeView> {
  const moderated = await deps.units.run(async ({ homes, audit }) => {
    const home = await homes.findByIdForUpdate(homeId);
    if (home === null) throw new HomeNotFoundError();
    const now = deps.clock.now();
    const approving = input.decision === 'approve';
    const decided = approving ? approveHome(home, now) : rejectHome(home, input.reason);
    const action: AuditAction = approving ? 'home.approve' : 'home.reject';
    await homes.save(decided);
    await audit.record({ actorId: adminId, action, entity: 'home', entityId: homeId, at: now });
    return decided;
  });
  const [view] = await viewsOf(deps, [moderated]);
  if (view === undefined) throw new Error('La vivienda moderada no tiene vista');
  return view;
}

/** Los casos de uso de moderación con sus dependencias ya inyectadas, listos para el transporte. */
export function moderationOperations(deps: ModerationDeps) {
  return {
    adminListHomes: (query: AdminHomesQuery) => adminListHomes(deps, query),
    adminModerateHome: (adminId: string, homeId: string, input: ModerationInput) =>
      adminModerateHome(deps, adminId, homeId, input),
  };
}
