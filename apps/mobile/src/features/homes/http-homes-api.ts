import type { HomeInput, HomePatch, PhotoContentType } from '@changehouse/shared';

import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';
import {
  type Home,
  type HomePhoto,
  type HomesApi,
  HomesApiError,
  type PhotoUpload,
} from './homes-api';

type Problem = components['schemas']['Problem'];

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const CONFLICT = 409;
const UNPROCESSABLE = 422;

const BUSINESS_KINDS: Record<
  string,
  | 'address-not-resolved'
  | 'invalid-value-range'
  | 'incomplete'
  | 'invalid-image'
  | 'photo-not-uploaded'
> = {
  ADDRESS_NOT_RESOLVED: 'address-not-resolved',
  INVALID_VALUE_RANGE: 'invalid-value-range',
  HOME_INCOMPLETE: 'incomplete',
  INVALID_IMAGE: 'invalid-image',
  PHOTO_NOT_UPLOADED: 'photo-not-uploaded',
};

const CONFLICT_KINDS: Record<string, 'photo-limit' | 'min-photos'> = {
  PHOTO_LIMIT_REACHED: 'photo-limit',
  HOME_MIN_PHOTOS: 'min-photos',
};

function failureOf(status: number, problem: Problem | undefined): HomesApiError {
  if (status === UNAUTHORIZED) return new HomesApiError('unauthorized');
  if (status === NOT_FOUND) return new HomesApiError('not-found');
  if (status === CONFLICT)
    return new HomesApiError(CONFLICT_KINDS[problem?.code ?? ''] ?? 'conflict');
  if (status === UNPROCESSABLE) {
    const kind = BUSINESS_KINDS[problem?.code ?? ''];
    const fields = (problem?.errors ?? []).map((error) => error.field);
    return new HomesApiError(kind ?? 'invalid', fields);
  }
  return new HomesApiError(status === BAD_REQUEST ? 'invalid' : 'server');
}

/** Sin respuesta del servidor `fetch` rechaza: se normaliza para que la interfaz no vea el original. */
async function request<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw new HomesApiError('network');
  }
}

/** `getHome` responde la ficha completa (propia) o la forma pública (ajena): solo la primera lleva estado. */
const isOwnHome = (home: object): home is Home => 'status' in home && 'address' in home;

/** Adaptador HTTP del puerto `HomesApi` sobre el cliente tipado. */
export function createHttpHomesApi(client: ApiClient): HomesApi {
  const pathOf = (homeId: string) => ({ params: { path: { homeId } } });

  return {
    async listMine(): Promise<Home[]> {
      const { data, error, response } = await request(() => client.GET('/me/homes'));
      if (data) return data;
      throw failureOf(response.status, error);
    },

    async get(homeId: string): Promise<Home> {
      const { data, error, response } = await request(() =>
        client.GET('/homes/{homeId}', pathOf(homeId)),
      );
      if (!data) throw failureOf(response.status, error);
      // La forma pública de una vivienda ajena no es una ficha propia: se trata como inexistente
      if (!isOwnHome(data)) throw new HomesApiError('not-found');
      return data;
    },

    async create(input: HomeInput): Promise<Home> {
      const { data, error, response } = await request(() => client.POST('/homes', { body: input }));
      if (data) return data;
      throw failureOf(response.status, error);
    },

    async update(homeId: string, patch: HomePatch): Promise<Home> {
      const { data, error, response } = await request(() =>
        client.PATCH('/homes/{homeId}', { ...pathOf(homeId), body: patch }),
      );
      if (data) return data;
      throw failureOf(response.status, error);
    },

    async submit(homeId: string): Promise<Home> {
      const { data, error, response } = await request(() =>
        client.POST('/homes/{homeId}/submit', pathOf(homeId)),
      );
      if (data) return data;
      throw failureOf(response.status, error);
    },

    async pause(homeId: string): Promise<Home> {
      const { data, error, response } = await request(() =>
        client.POST('/homes/{homeId}/pause', pathOf(homeId)),
      );
      if (data) return data;
      throw failureOf(response.status, error);
    },

    async resume(homeId: string): Promise<Home> {
      const { data, error, response } = await request(() =>
        client.POST('/homes/{homeId}/resume', pathOf(homeId)),
      );
      if (data) return data;
      throw failureOf(response.status, error);
    },

    async createPhotoUpload(homeId: string, contentType: PhotoContentType): Promise<PhotoUpload> {
      const { data, error, response } = await request(() =>
        client.POST('/homes/{homeId}/photos', { ...pathOf(homeId), body: { contentType } }),
      );
      if (data) return data;
      throw failureOf(response.status, error);
    },

    async completePhotoUpload(homeId: string, photoId: string): Promise<HomePhoto> {
      const { data, error, response } = await request(() =>
        client.POST('/homes/{homeId}/photos/{photoId}/complete', {
          params: { path: { homeId, photoId } },
        }),
      );
      if (data) return data;
      throw failureOf(response.status, error);
    },

    async deletePhoto(homeId: string, photoId: string): Promise<void> {
      const { error, response } = await request(() =>
        client.DELETE('/homes/{homeId}/photos/{photoId}', {
          params: { path: { homeId, photoId } },
        }),
      );
      if (!response.ok) throw failureOf(response.status, error);
    },
  };
}
