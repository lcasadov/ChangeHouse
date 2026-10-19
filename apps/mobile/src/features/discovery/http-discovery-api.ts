import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';
import {
  type DiscoveryApi,
  DiscoveryApiError,
  type DiscoveryPage,
  type DiscoveryQuery,
  type PublicHome,
} from './discovery-api';

type Problem = components['schemas']['Problem'];

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const UNPROCESSABLE = 422;
const HOME_ID_REQUIRED = 'HOME_ID_REQUIRED';
const PREFERENCES_REQUIRED = 'SEARCH_PREFERENCES_REQUIRED';

function failureOf(status: number, problem: Problem | undefined): DiscoveryApiError {
  if (status === UNAUTHORIZED) return new DiscoveryApiError('unauthorized');
  if (status === NOT_FOUND) return new DiscoveryApiError('not-found');
  if (status === BAD_REQUEST) {
    return new DiscoveryApiError(problem?.code === HOME_ID_REQUIRED ? 'home-required' : 'invalid');
  }
  if (status === UNPROCESSABLE && problem?.code === PREFERENCES_REQUIRED) {
    return new DiscoveryApiError('preferences-required');
  }
  return new DiscoveryApiError('server');
}

/** Sin respuesta del servidor `fetch` rechaza: se normaliza para que la interfaz no vea el original. */
async function request<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw new DiscoveryApiError('network');
  }
}

/** Solo lo público: aunque el servidor enviara más (una dirección), nunca llega a la interfaz. */
function publicOf(home: PublicHome): PublicHome {
  return {
    id: home.id,
    type: home.type,
    regime: home.regime,
    usefulM2: home.usefulM2,
    builtM2: home.builtM2,
    bedrooms: home.bedrooms,
    bathrooms: home.bathrooms,
    ...(home.floor === undefined ? {} : { floor: home.floor }),
    ...(home.hasLift === undefined ? {} : { hasLift: home.hasLift }),
    ...(home.garage === undefined ? {} : { garage: home.garage }),
    ...(home.storageRoom === undefined ? {} : { storageRoom: home.storageRoom }),
    ...(home.features === undefined ? {} : { features: home.features }),
    ...(home.energyRating === undefined ? {} : { energyRating: home.energyRating }),
    ...(home.yearBuilt === undefined ? {} : { yearBuilt: home.yearBuilt }),
    valueMinCents: home.valueMinCents,
    valueMaxCents: home.valueMaxCents,
    location: {
      visibility: home.location.visibility,
      point: home.location.point,
      areaName: home.location.areaName,
    },
    photos: home.photos,
  };
}

/** Adaptador HTTP del puerto `DiscoveryApi` sobre el cliente tipado. */
export function createHttpDiscoveryApi(client: ApiClient): DiscoveryApi {
  return {
    async list({ homeId, cursor }: DiscoveryQuery): Promise<DiscoveryPage> {
      const query = { ...(homeId ? { homeId } : {}), ...(cursor ? { cursor } : {}) };
      const { data, error, response } = await request(() =>
        client.GET('/discover', { params: { query } }),
      );
      if (!data) throw failureOf(response.status, error);
      return { items: data.items, nextCursor: data.nextCursor ?? null };
    },

    async getPublicHome(homeId: string): Promise<PublicHome> {
      const { data, error, response } = await request(() =>
        client.GET('/homes/{homeId}', { params: { path: { homeId } } }),
      );
      if (!data) throw failureOf(response.status, error);
      return publicOf(data);
    },
  };
}
