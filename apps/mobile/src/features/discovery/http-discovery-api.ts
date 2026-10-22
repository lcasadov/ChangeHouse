import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';
import {
  DecisionApiError,
  type DiscoveryApi,
  DiscoveryApiError,
  type DiscoveryPage,
  type DiscoveryQuery,
  type PublicHome,
} from './discovery-api';

type Problem = components['schemas']['Problem'];

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONFLICT = 409;
const UNPROCESSABLE = 422;
const TOO_MANY_REQUESTS = 429;
const HOME_ID_REQUIRED = 'HOME_ID_REQUIRED';
const PREFERENCES_REQUIRED = 'SEARCH_PREFERENCES_REQUIRED';
const HOME_NOT_PUBLISHED = 'HOME_NOT_PUBLISHED';
const LIKE_EXISTS = 'LIKE_EXISTS';
const LIKE_IN_MATCH = 'LIKE_IN_MATCH';
const WHOLE_SECONDS = /^\d+$/;

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

/** Los segundos de `Retry-After`; cualquier otro valor (una fecha, un texto) se ignora. */
function retryAfterOf(response: Response): number | undefined {
  const value = response.headers.get('retry-after');
  if (value === null || !WHOLE_SECONDS.test(value)) return undefined;
  const seconds = Number(value);
  return seconds > 0 ? seconds : undefined;
}

function conflictOf(problem: Problem | undefined): DecisionApiError {
  if (problem?.code === HOME_NOT_PUBLISHED) return new DecisionApiError('home-not-published');
  if (problem?.code === LIKE_EXISTS) return new DecisionApiError('already-liked');
  if (problem?.code === LIKE_IN_MATCH) return new DecisionApiError('like-in-match');
  return new DecisionApiError('server');
}

function decisionFailureOf(response: Response, problem: Problem | undefined): DecisionApiError {
  const { status } = response;
  if (status === UNAUTHORIZED) return new DecisionApiError('unauthorized');
  if (status === FORBIDDEN) return new DecisionApiError('forbidden');
  if (status === NOT_FOUND) return new DecisionApiError('not-found');
  if (status === BAD_REQUEST) return new DecisionApiError('invalid');
  if (status === CONFLICT) return conflictOf(problem);
  if (status === TOO_MANY_REQUESTS) {
    return new DecisionApiError('daily-limit', retryAfterOf(response));
  }
  return new DecisionApiError('server');
}

/** Sin respuesta del servidor `fetch` rechaza: se normaliza para que la interfaz no vea el original. */
async function decisionRequest<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw new DecisionApiError('network');
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
    vppMaxLegalPriceCents: home.vppMaxLegalPriceCents,
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

    async like(input) {
      const { data, error, response } = await decisionRequest(() =>
        client.POST('/me/likes', { body: input }),
      );
      if (!data) throw decisionFailureOf(response, error);
      return data;
    },

    async dismiss(input) {
      const { error, response } = await decisionRequest(() =>
        client.POST('/me/dismissals', { body: input }),
      );
      if (!response.ok) throw decisionFailureOf(response, error);
    },

    async undo({ homeId }) {
      const { error, response } = await decisionRequest(() =>
        client.DELETE('/me/last-action', { params: { query: homeId ? { homeId } : {} } }),
      );
      if (!response.ok) throw decisionFailureOf(response, error);
    },
  };
}
