import createClient from 'openapi-fetch';

import type { paths } from './schema';

export interface ApiClientOptions {
  /** `EXPO_PUBLIC_API_URL`: base de la API con su prefijo de versión (`/v1`), sin barra final. */
  baseUrl: string;
  /** ID token vigente de la sesión, o `null` si no hay sesión. Se pide en cada petición. */
  getToken: () => Promise<string | null>;
  /** Solo para pruebas: la frontera HTTP simulada. Por defecto, el `fetch` global. */
  fetch?: (request: Request) => Promise<Response>;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * El único cliente HTTP de la app, tipado desde `docs/api/openapi.yaml` (`pnpm generate:api`).
 * Añade `Authorization: Bearer <idToken>` en cada petición; Firebase renueva el token cuando caduca.
 */
export function createApiClient({ baseUrl, getToken, fetch }: Readonly<ApiClientOptions>) {
  const client = createClient<paths>({ baseUrl, ...(fetch ? { fetch } : {}) });
  client.use({
    async onRequest({ request }) {
      const token = await getToken();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    },
  });
  return client;
}
