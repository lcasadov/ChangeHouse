import type { Home } from '../../domain/home/home.js';
import type { SearchPreferences } from '../../domain/search-preferences/search-preferences.js';
import type { PublicHome } from '../home/home-views.js';
import type { ModerationCursor } from '../moderation/cursor.js';

/** Posición en las tarjetas: fecha de publicación y el id que desempata (el cursor opaco). */
export type DiscoveryPosition = ModerationCursor;

/** Fase 1 del descubrimiento: lo que el almacén filtra con PostGIS antes de la economía. */
export interface CandidateQuery {
  /** Quien busca: sus viviendas nunca son candidatas. */
  readonly viewerId: string;
  /** Lo que busca: zona (municipios o punto con radio) y filtros. */
  readonly preferences: SearchPreferences;
  /** Si el usuario declara cumplir los requisitos de acceso a VPP (RN-06). */
  readonly includeVpp: boolean;
  /**
   * Vivienda propia y publicada desde la que se busca: activa la compatibilidad inversa (la
   * candidata busca donde está y como es esta vivienda) y sus descartes. `null` en modo `seeker`.
   */
  readonly origin: Home | null;
  /** Continúa tras esta posición (exclusiva). */
  readonly after: DiscoveryPosition | null;
  readonly limit: number;
}

/** Límites de compensación de las preferencias efectivas del dueño de la candidata (RN-03). */
export interface OwnerTerms {
  readonly maxToPayCents: number;
  readonly minToReceiveCents: number;
  readonly valueReferencePct: number;
}

/** Una vivienda candidata, de la publicada más recientemente a la más antigua. */
export interface DiscoveryCandidate {
  readonly home: PublicHome;
  readonly publishedAt: Date;
  /** Las condiciones de su dueño; solo cuando se busca desde una vivienda (`origin`). */
  readonly ownerTerms: OwnerTerms | null;
}

/** Puerto de salida: la fase 1 del descubrimiento. */
export interface DiscoveryRepository {
  findCandidates(query: CandidateQuery): Promise<DiscoveryCandidate[]>;
}
