import createClient from 'openapi-fetch';

import type { paths } from './schema';

export interface ApiClientOptions {
  /** `EXPO_PUBLIC_API_URL`: base de la API con su prefijo de versión (`/v1`), sin barra final. */
  baseUrl: string;
  /** ID token vigente de la sesión, o `null` si no hay sesión. Se pide en cada petición. */
  getToken: () => Promise<string | null>;
  /** Solo para pruebas: la frontera HTTP simulada. Por defecto, el `fetch` global. */
  fetch?: (request: Request) => Promise<Response>;
  /** Se llama cuando la API responde 403 `ACCOUNT_SUSPENDED` a cualquier petición. */
  onAccountSuspended?: () => void;
}

const FORBIDDEN = 403;
const ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED';

/** Si la respuesta es el 403 de una cuenta suspendida; lee una copia para no consumir el cuerpo. */
async function isAccountSuspended(response: Response): Promise<boolean> {
  if (response.status !== FORBIDDEN) return false;
  try {
    const problem = (await response.clone().json()) as { code?: unknown } | null;
    return problem?.code === ACCOUNT_SUSPENDED;
  } catch {
    // Un 403 sin cuerpo JSON no es el de una cuenta suspendida
    return false;
  }
}

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * El único cliente HTTP de la app, tipado desde `docs/api/openapi.yaml` (`pnpm generate:api`).
 * Añade `Authorization: Bearer <idToken>` en cada petición; Firebase renueva el token cuando caduca.
 * Detecta la respuesta de una cuenta suspendida y lo avisa con `onAccountSuspended`.
 */
export function createApiClient({
  baseUrl,
  getToken,
  fetch,
  onAccountSuspended,
}: Readonly<ApiClientOptions>) {
  const client = createClient<paths>({ baseUrl, ...(fetch ? { fetch } : {}) });
  client.use({
    async onRequest({ request }) {
      const token = await getToken();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    },
    // Una cuenta suspendida puede recibir el 403 desde cualquier pantalla: se avisa una sola vez aquí
    async onResponse({ response }) {
      if (onAccountSuspended && (await isAccountSuspended(response))) onAccountSuspended();
      return response;
    },
  });
  return client;
}
