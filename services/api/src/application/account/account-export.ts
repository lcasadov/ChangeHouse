import type { CycleType } from '../../domain/matching/cycle.js';
import type { MatchStatus, ParticipantStatus } from '../../domain/matching/match.js';
import type { Clock } from '../clock.js';
import type { HomeRepository } from '../home/home-repository.js';
import { type HomeView, toHomeView, toPhotoViews } from '../home/home-views.js';
import type { PhotoRepository } from '../home/photo-repository.js';
import type { PhotoStorage } from '../home/photo-storage.js';
import type { SearchPreferencesRepository } from '../search-preferences/search-preferences-repository.js';
import {
  type SearchPreferencesView,
  toSearchPreferencesView,
} from '../search-preferences/search-preferences-views.js';
import type { ConsentRepository } from './consent-repository.js';
import { AccountNotFoundError } from './errors.js';
import type { UserRepository } from './user-repository.js';

export interface ExportedLike {
  readonly fromHomeId: string;
  readonly toHomeId: string;
  readonly createdAt: Date;
}

export interface ExportedDismissal {
  /** Vivienda desde la que se descartó; `null` si fue desde la cuenta (un `seeker`). */
  readonly homeId: string | null;
  readonly dismissedHomeId: string;
  readonly createdAt: Date;
}

/** La participación del propio usuario en un match: solo sus datos, nunca los de otros. */
export interface ExportedParticipation {
  readonly homeId: string;
  readonly givesHomeId: string;
  readonly receivesHomeId: string;
  readonly compensationCents: number;
  readonly status: ParticipantStatus;
  readonly sharesPhone: boolean;
}

export interface ExportedMatch {
  readonly id: string;
  readonly type: CycleType;
  readonly status: MatchStatus;
  readonly createdAt: Date;
  readonly participation: readonly ExportedParticipation[];
  /** Solo identificadores de las viviendas de los demás participantes. */
  readonly otherHomeIds: readonly string[];
}

/** Puerto de salida: lo que la exportación lee y no tiene un repositorio propio. */
export interface AccountExportReader {
  likesOf(userId: string): Promise<ExportedLike[]>;
  dismissalsOf(userId: string): Promise<ExportedDismissal[]>;
  matchesOf(userId: string): Promise<ExportedMatch[]>;
}

export interface AccountExportDeps {
  users: Pick<UserRepository, 'findById'>;
  consents: Pick<ConsentRepository, 'listByUser'>;
  homes: Pick<HomeRepository, 'listByOwner'>;
  photos: Pick<PhotoRepository, 'listReadyByHomes'>;
  storage: Pick<PhotoStorage, 'publicUrl'>;
  preferences: Pick<SearchPreferencesRepository, 'find'>;
  reader: AccountExportReader;
  clock: Clock;
}

/** Los datos personales del usuario en JSON (portabilidad, RF-05); las fechas viajan en ISO 8601. */
export interface AccountExport {
  exportedAt: string;
  account: {
    id: string;
    email: string;
    displayName: string;
    phone: string | null;
    municipality: string | null;
    meetsVppRequirements: boolean;
    isOver65: boolean;
    createdAt: string;
  };
  homes: HomeView[];
  searchPreferences: {
    default: SearchPreferencesView | null;
    byHome: (SearchPreferencesView & { homeId: string })[];
  };
  likes: { fromHomeId: string; toHomeId: string; createdAt: string }[];
  dismissals: { homeId: string | null; dismissedHomeId: string; createdAt: string }[];
  matches: {
    id: string;
    type: CycleType;
    status: MatchStatus;
    createdAt: string;
    participation: readonly ExportedParticipation[];
    otherHomeIds: readonly string[];
  }[];
  consents: { type: string; version: string; acceptedAt: string }[];
}

async function searchPreferencesOf(
  deps: AccountExportDeps,
  userId: string,
  homeIds: readonly string[],
): Promise<AccountExport['searchPreferences']> {
  const own = await deps.preferences.find({ userId, homeId: null });
  const byHome: AccountExport['searchPreferences']['byHome'] = [];
  for (const homeId of homeIds) {
    const found = await deps.preferences.find({ userId, homeId });
    if (found) byHome.push({ homeId, ...toSearchPreferencesView(found) });
  }
  return { default: own ? toSearchPreferencesView(own) : null, byHome };
}

/**
 * Exportación de los datos del propio usuario: cuenta, viviendas (con su dirección), preferencias,
 * me gusta, descartes, matches y consentimientos. De un match solo la participación propia y los
 * ids de las otras viviendas: nada de nombres, teléfonos ni direcciones ajenas.
 */
export async function exportMyData(
  deps: AccountExportDeps,
  userId: string,
): Promise<AccountExport> {
  const user = await deps.users.findById(userId);
  if (!user || user.deletedAt !== null) throw new AccountNotFoundError();

  const homes = await deps.homes.listByOwner(userId);
  const homeIds = homes.map((home) => home.id);
  const [ready, preferences, likes, dismissals, matches, consents] = await Promise.all([
    deps.photos.listReadyByHomes(homeIds),
    searchPreferencesOf(deps, userId, homeIds),
    deps.reader.likesOf(userId),
    deps.reader.dismissalsOf(userId),
    deps.reader.matchesOf(userId),
    deps.consents.listByUser(userId),
  ]);

  return {
    exportedAt: deps.clock.now().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      phone: user.phone,
      municipality: user.municipality,
      meetsVppRequirements: user.meetsVppRequirements,
      isOver65: user.isOver65,
      createdAt: user.createdAt.toISOString(),
    },
    homes: homes.map((home) =>
      toHomeView(
        home,
        toPhotoViews(
          ready.filter((photo) => photo.homeId === home.id),
          (path) => deps.storage.publicUrl(path),
        ),
      ),
    ),
    searchPreferences: preferences,
    likes: likes.map((like) => ({ ...like, createdAt: like.createdAt.toISOString() })),
    dismissals: dismissals.map((dismissal) => ({
      ...dismissal,
      createdAt: dismissal.createdAt.toISOString(),
    })),
    matches: matches.map((match) => ({ ...match, createdAt: match.createdAt.toISOString() })),
    consents: consents.map((consent) => ({
      type: consent.type,
      version: consent.version,
      acceptedAt: consent.acceptedAt.toISOString(),
    })),
  };
}

/** El caso de uso con sus dependencias ya inyectadas, listo para el transporte. */
export function accountExportOperations(deps: AccountExportDeps) {
  return { exportMyData: (userId: string) => exportMyData(deps, userId) };
}
