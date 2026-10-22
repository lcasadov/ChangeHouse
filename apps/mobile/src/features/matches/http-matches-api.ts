import type { ApiClient } from '../../api/client';
import { type MatchesApi, MatchesApiError, type MatchesQuery, type MatchPage } from './matches-api';

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;

function failureOf(status: number): MatchesApiError {
  if (status === UNAUTHORIZED) return new MatchesApiError('unauthorized');
  if (status === FORBIDDEN) return new MatchesApiError('forbidden');
  if (status === BAD_REQUEST) return new MatchesApiError('invalid');
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
  };
}
