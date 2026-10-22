import type { components } from '../api/schema';
import type { Home } from '../features/homes/homes-api';
import { json, problem } from './http-responses';

export type DiscoveryCard = components['schemas']['DiscoveryCard'];
type Compensation = DiscoveryCard['compensation'];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const PHOTO_BASE_URL = 'https://cdn.changehouse.test/discover';
const HOME_PATH = /^\/homes\/([^/]+)$/;

let sequence = 0;

/** Una vivienda ajena publicada, con su compensación (`null` si quien mira no tiene vivienda). */
export function discoveryCard(
  overrides: Partial<DiscoveryCard> & { photoCount?: number } = {},
): DiscoveryCard {
  sequence += 1;
  const { photoCount = 3, ...rest } = overrides;
  const id = `0198f3a0-aaaa-7000-8000-${String(sequence).padStart(12, '0')}`;
  return {
    id,
    type: 'piso',
    regime: 'libre',
    usefulM2: 82,
    builtM2: 96,
    bedrooms: 3,
    bathrooms: 2,
    floor: '3º',
    hasLift: true,
    garage: false,
    storageRoom: true,
    features: { terrace: true, airConditioning: true },
    energyRating: 'C',
    yearBuilt: 1998,
    valueMinCents: 21_000_000,
    valueMaxCents: 23_000_000,
    location: {
      visibility: 'area',
      point: { lat: 40.4168, lng: -3.7038 },
      areaName: 'Lavapiés',
    },
    photos: Array.from({ length: photoCount }, (_, index) => ({
      id: `0198f3a0-bbbb-7000-8000-${String(sequence * 100 + index).padStart(12, '0')}`,
      url: `${PHOTO_BASE_URL}/${String(sequence)}-${String(index + 1)}.webp`,
      position: index + 1,
    })),
    compensation: { kind: 'pay', amountCents: 1_200_000 },
    ...rest,
  };
}

/** Un rechazo preparado para la siguiente consulta, con la forma del `Problem` del contrato. */
interface Rejection {
  status: number;
  extra: Record<string, unknown>;
}

/**
 * El descubrimiento con las reglas de `discoverHomes` que ve la interfaz: modo `seeker` sin
 * compensación, `homeId` obligatorio con varias viviendas publicadas (400), vivienda ajena o no
 * publicada (404), búsqueda sin preferencias (422) y paginación por cursor opaco.
 */
export class FakeDiscovery {
  /** Las tarjetas que se ofrecen desde cualquier vivienda salvo que haya una lista propia. */
  cards: readonly DiscoveryCard[];
  /** Tarjetas distintas para una vivienda concreta (la compensación depende de la vivienda). */
  readonly byHome = new Map<string, readonly DiscoveryCard[]>();
  /** Tamaño de página del servidor cuando la petición no indica `limit`. */
  pageSize = DEFAULT_PAGE_SIZE;
  private rejection: Rejection | null = null;
  private pageRejection: Rejection | null = null;
  private detailAddress: string | null = null;

  constructor(
    cards: readonly DiscoveryCard[],
    private readonly ownHomes: () => readonly Home[],
    private readonly hasPreferences: () => boolean,
    /** Lo ya decidido (me gusta o descartado) desde esa vivienda, o desde la cuenta con `null`, no se vuelve a ofrecer. */
    private readonly isDecided: (viewer: string | null, cardId: string) => boolean = () => false,
  ) {
    this.cards = cards;
  }

  /** La siguiente consulta responde con este error. */
  rejectNext(status: number, extra: Record<string, unknown> = {}): void {
    this.rejection = { status, extra };
  }

  /** La siguiente consulta de una página posterior a la primera (con cursor) responde con este error. */
  rejectNextPage(status: number, extra: Record<string, unknown> = {}): void {
    this.pageRejection = { status, extra };
  }

  /** El detalle público devuelve también una dirección (un fallo del servidor): la interfaz no debe mostrarla. */
  leakAddressInDetail(address: string): void {
    this.detailAddress = address;
  }

  /** `true` si alguna vivienda ofrecida tiene ese identificador. */
  offers(homeId: string): boolean {
    return [...this.cards, ...[...this.byHome.values()].flat()].some((card) => card.id === homeId);
  }

  /** La forma pública de una vivienda ofrecida (`getHome` de una vivienda ajena), o `null`. */
  publicHome(path: string): Response | null {
    const id = HOME_PATH.exec(path)?.[1];
    const all = [...this.cards, ...[...this.byHome.values()].flat()];
    const card = all.find((candidate) => candidate.id === id);
    if (!card) return null;
    const home: Partial<DiscoveryCard> = { ...card };
    delete home.compensation;
    return json(200, this.detailAddress ? { ...home, address: this.detailAddress } : home);
  }

  respond(search: URLSearchParams): Response {
    const rejection = this.rejection;
    if (rejection) {
      this.rejection = null;
      return problem(rejection.status, rejection.extra);
    }
    const pageRejection = this.pageRejection;
    if (pageRejection && search.has('cursor')) {
      this.pageRejection = null;
      return problem(pageRejection.status, pageRejection.extra);
    }
    if (!this.hasPreferences()) return problem(422, { code: 'SEARCH_PREFERENCES_REQUIRED' });

    const published = this.ownHomes().filter((home) => home.status === 'published');
    const requested = search.get('homeId');
    if (requested !== null && !published.some((home) => home.id === requested)) return problem(404);
    if (requested === null && published.length > 1) {
      return problem(400, {
        code: 'HOME_ID_REQUIRED',
        errors: [{ field: 'homeId', message: 'required' }],
      });
    }
    const homeId = requested ?? published[0]?.id;
    const available = (homeId ? this.byHome.get(homeId) : undefined) ?? this.cards;
    const seeker = published.length === 0;

    const limit = Math.min(Number(search.get('limit') ?? this.pageSize), MAX_PAGE_SIZE);
    const start = Number(search.get('cursor') ?? 0);
    // El cursor es una posición en la lista completa: lo decidido se quita de la página, no de la cuenta
    const window = available.slice(start, start + limit);
    const end = start + window.length;
    const viewer = seeker ? null : (homeId ?? null);
    const page = window.filter((card) => !this.isDecided(viewer, card.id));
    return json(200, {
      items: seeker ? page.map((card) => ({ ...card, compensation: null as Compensation })) : page,
      nextCursor: end < available.length ? String(end) : null,
    });
  }
}
