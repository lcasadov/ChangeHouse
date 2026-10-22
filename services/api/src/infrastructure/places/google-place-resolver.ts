import type { PlaceResolver } from '../../application/home/place-resolver.js';
import type { GeoPoint, HomeLocation } from '../../domain/home/home.js';

const PLACES_BASE = 'https://places.googleapis.com/v1';
/** Radio con el que se sesga la búsqueda del barrio hacia la propia dirección. */
const AREA_SEARCH_RADIUS_METERS = 3000;
const NOT_FOUND = 404;
const BAD_REQUEST = 400;

/** Del más específico al más general: el primero que exista da el nombre del barrio o zona. */
const AREA_COMPONENT_TYPES = ['sublocality_level_1', 'sublocality', 'neighborhood', 'locality'];

interface PlacesPoint {
  latitude?: number;
  longitude?: number;
}

interface AddressComponent {
  longText?: string;
  types?: string[];
}

interface PlaceDetails {
  location?: PlacesPoint;
  addressComponents?: AddressComponent[];
}

interface SearchResult {
  places?: { location?: PlacesPoint }[];
}

export interface GooglePlaceResolverOptions {
  /** Clave de servidor (nunca la de la app): vive en Secret Manager. */
  apiKey: string;
  /** Solo para pruebas. */
  fetch?: typeof fetch;
}

function toPoint(point: PlacesPoint | undefined): GeoPoint | null {
  if (point?.latitude === undefined || point.longitude === undefined) return null;
  return { lat: point.latitude, lng: point.longitude };
}

function componentText(components: AddressComponent[], type: string): string | undefined {
  return components.find((component) => component.types?.includes(type))?.longText;
}

function areaNameOf(components: AddressComponent[]): string | null {
  for (const type of AREA_COMPONENT_TYPES) {
    const name = componentText(components, type);
    if (name) return name;
  }
  return null;
}

/**
 * Resuelve el `placeId` del autocompletado con Places API (New): los detalles dan el punto exacto y
 * el barrio o zona, y una búsqueda de texto da el centro de esa zona, que es lo único que se
 * publica por defecto. Si no se puede situar el centro, la dirección no se resuelve: nunca se cae
 * al punto exacto, que es lo que la ubicación por zona debe ocultar.
 */
export class GooglePlaceResolver implements PlaceResolver {
  private readonly apiKey: string;
  private readonly request: typeof fetch;

  constructor(options: GooglePlaceResolverOptions) {
    if (!options.apiKey) throw new Error('Falta la clave de servidor de Google Places');
    this.apiKey = options.apiKey;
    this.request = options.fetch ?? fetch;
  }

  async resolve(placeId: string): Promise<HomeLocation | null> {
    const details = await this.details(placeId);
    const exact = toPoint(details?.location);
    const components = details?.addressComponents ?? [];
    const areaName = areaNameOf(components);
    if (exact === null || areaName === null) return null;

    const locality = componentText(components, 'locality');
    const query = locality && locality !== areaName ? `${areaName}, ${locality}` : areaName;
    const areaCenter = await this.areaCenter(query, exact);
    return areaCenter === null ? null : { exact, areaName, areaCenter };
  }

  private async details(placeId: string): Promise<PlaceDetails | null> {
    const response = await this.request(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}`, {
      method: 'GET',
      headers: this.headers('location,addressComponents'),
    });
    // Un identificador inexistente o mal formado es «no reconocida»; lo demás, un fallo técnico
    if (response.status === NOT_FOUND || (await this.isBadPlaceId(response))) return null;
    return (await this.parse(response, 'detalles')) as PlaceDetails;
  }

  private async areaCenter(query: string, near: GeoPoint): Promise<GeoPoint | null> {
    const response = await this.request(`${PLACES_BASE}/places:searchText`, {
      method: 'POST',
      headers: { ...this.headers('places.location'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 1,
        locationBias: {
          circle: {
            center: { latitude: near.lat, longitude: near.lng },
            radius: AREA_SEARCH_RADIUS_METERS,
          },
        },
      }),
    });
    const result = (await this.parse(response, 'búsqueda')) as SearchResult;
    return toPoint(result.places?.[0]?.location);
  }

  /** Google responde 400 también cuando la clave no vale: eso es una avería nuestra, no del usuario. */
  private async isBadPlaceId(response: Response): Promise<boolean> {
    if (response.status !== BAD_REQUEST) return false;
    const body = await response.text();
    return !/api key|api_key|key invalid|permission/i.test(body);
  }

  private headers(fieldMask: string): Record<string, string> {
    return { 'X-Goog-Api-Key': this.apiKey, 'X-Goog-FieldMask': fieldMask };
  }

  /** El mensaje lleva el estado HTTP y nada más: ni la clave ni el cuerpo de Google. */
  private async parse(response: Response, operation: string): Promise<unknown> {
    if (!response.ok) {
      throw new Error(
        `Google Places rechazó la petición de ${operation}: HTTP ${String(response.status)}`,
      );
    }
    return response.json();
  }
}
