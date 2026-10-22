import { type PhotoContentType, validatePhotoUploadInput } from '@changehouse/shared';
import type { FastifyPluginCallback } from 'fastify';

import { HomeNotFoundError, PhotoNotFoundError } from '../../../application/home/errors.js';
import type { PhotoUploadView, PhotoView } from '../../../application/home/home-views.js';
import { accountId, uuidOr404, validated } from './request-helpers.js';

export interface PhotoRouteOptions {
  createPhotoUpload: (
    userId: string,
    homeId: string,
    contentType: PhotoContentType,
  ) => Promise<PhotoUploadView>;
  completePhotoUpload: (userId: string, homeId: string, photoId: string) => Promise<PhotoView>;
  deletePhoto: (userId: string, homeId: string, photoId: string) => Promise<void>;
}

interface HomeParams {
  homeId: string;
}

interface PhotoParams extends HomeParams {
  photoId: string;
}

const NO_CONTENT = 204;
const CREATED = 201;

/**
 * `createHomePhotoUpload`, `completeHomePhotoUpload` y `deleteHomePhoto` del contrato (RF-11).
 * Solo transporte: la política central decide el acceso por rol y los casos de uso, la propiedad.
 */
export function photoRoutes(options: PhotoRouteOptions): FastifyPluginCallback {
  return (app, _options, done) => {
    app.post<{ Params: HomeParams }>(
      '/homes/:homeId/photos',
      { config: { operationId: 'createHomePhotoUpload' } },
      async (request, reply) => {
        const homeId = uuidOr404(request.params.homeId, () => new HomeNotFoundError());
        const { contentType } = validated(validatePhotoUploadInput(request.body));
        const upload = await options.createPhotoUpload(accountId(request), homeId, contentType);
        return reply.code(CREATED).send(upload);
      },
    );
    app.post<{ Params: PhotoParams }>(
      '/homes/:homeId/photos/:photoId/complete',
      { config: { operationId: 'completeHomePhotoUpload' } },
      (request) => {
        const homeId = uuidOr404(request.params.homeId, () => new HomeNotFoundError());
        const photoId = uuidOr404(request.params.photoId, () => new PhotoNotFoundError());
        return options.completePhotoUpload(accountId(request), homeId, photoId);
      },
    );
    app.delete<{ Params: PhotoParams }>(
      '/homes/:homeId/photos/:photoId',
      { config: { operationId: 'deleteHomePhoto' } },
      async (request, reply) => {
        const homeId = uuidOr404(request.params.homeId, () => new HomeNotFoundError());
        const photoId = uuidOr404(request.params.photoId, () => new PhotoNotFoundError());
        await options.deletePhoto(accountId(request), homeId, photoId);
        return reply.code(NO_CONTENT).send();
      },
    );
    done();
  };
}
