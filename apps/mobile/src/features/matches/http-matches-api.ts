import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';
import {
  type Match,
  type MatchDetail,
  type MatchesApi,
  MatchesApiError,
  type MatchesQuery,
  type MatchPage,
} from './matches-api';

type Problem = components['schemas']['Problem'];

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONFLICT = 409;
const MATCH_NOT_OPEN = 'MATCH_NOT_OPEN';

function failureOf(status: number, problem?: Problem): MatchesApiError {
  if (status === UNAUTHORIZED) return new MatchesApiError('unauthorized');
  if (status === FORBIDDEN) return new MatchesApiError('forbidden');
  if (status === BAD_REQUEST) return new MatchesApiError('invalid');
  if (status === NOT_FOUND) return new MatchesApiError('not-found');
  if (status === CONFLICT && problem?.code === MATCH_NOT_OPEN) {
    return new MatchesApiError('not-open');
  }
  return new MatchesApiError('server');
}

/** Sin respuesta del servidor `fetch` rechaza: se normaliza para que la interfaz no vea el original. */
async function request<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw new MatchesApiError('network');
  }
}

/** Adaptador HTTP del puerto `MatchesApi` sobre el cliente tipado. */
export function createHttpMatchesApi(client: ApiClient): MatchesApi {
  return {
    async list({ cursor }: MatchesQuery): Promise<MatchPage> {
      const { data, response } = await request(() =>
        client.GET('/matches', { params: { query: cursor ? { cursor } : {} } }),
      );
      if (!data) throw failureOf(response.status);
      return { items: data.items, nextCursor: data.nextCursor ?? null };
    },

    async get(matchId: string): Promise<MatchDetail> {
      const { data, error, response } = await request(() =>
        client.GET('/matches/{matchId}', { params: { path: { matchId } } }),
      );
      if (!data) throw failureOf(response.status, error);
      return data;
    },

    async confirm(matchId: string): Promise<Match> {
      const { data, error, response } = await request(() =>
        client.POST('/matches/{matchId}/confirm', { params: { path: { matchId } } }),
      );
      if (!data) throw failureOf(response.status, error);
      return data;
    },

    async withdraw(matchId: string): Promise<Match> {
      const { data, error, response } = await request(() =>
        client.POST('/matches/{matchId}/withdraw', { params: { path: { matchId } } }),
      );
      if (!data) throw failureOf(response.status, error);
      return data;
    },

    async setPhoneSharing(matchId: string, share: boolean): Promise<void> {
      const { error, response } = await request(() =>
        client.PUT('/matches/{matchId}/phone-sharing', {
          params: { path: { matchId } },
          body: { share },
        }),
      );
      if (!response.ok) throw failureOf(response.status, error);
    },
  };
}
