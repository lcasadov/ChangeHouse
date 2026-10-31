import type { MeInput } from '@changehouse/shared';

import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';
import { type AccountApi, AccountApiError, type DeviceRegistration, type Me } from './account-api';

type Problem = components['schemas']['Problem'];

const LEGAL_ACCEPTANCE_REQUIRED = 'LEGAL_ACCEPTANCE_REQUIRED';

function failureOf(status: number, problem: Problem | undefined): AccountApiError {
  if (status === 401) return new AccountApiError('unauthorized');
  if (status === 422 && problem?.code === LEGAL_ACCEPTANCE_REQUIRED) {
    return new AccountApiError('legal-acceptance');
  }
  if (status === 400 || status === 422) return new AccountApiError('invalid');
  return new AccountApiError('server');
}

/** Sin respuesta del servidor `fetch` rechaza: se normaliza para que la interfaz no vea el original. */
async function request<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw new AccountApiError('network');
  }
}

/** Adaptador HTTP del puerto `AccountApi` sobre el cliente tipado (`getMe`, `upsertMe`). */
export function createHttpAccountApi(client: ApiClient): AccountApi {
  return {
    async getMe(): Promise<Me | null> {
      const { data, error, response } = await request(() => client.GET('/me'));
      if (data) return data;
      // Autenticada pero sin alta: el contrato responde 404 hasta el primer `upsertMe`
      if (response.status === 404) return null;
      throw failureOf(response.status, error);
    },

    async upsertMe(input: MeInput): Promise<Me> {
      const { data, error, response } = await request(() => client.PUT('/me', { body: input }));
      if (data) return data;
      throw failureOf(response.status, error);
    },

    async registerDevice(input: DeviceRegistration): Promise<void> {
      const { error, response } = await request(() => client.PUT('/me/devices', { body: input }));
      if (!response.ok) throw failureOf(response.status, error);
    },
  };
}
