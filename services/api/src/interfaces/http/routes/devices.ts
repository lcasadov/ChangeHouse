import { type DeviceInput, validateDeviceInput } from '@changehouse/shared';
import type { FastifyPluginCallback } from 'fastify';

import { accountId, validated } from './request-helpers.js';

export interface DeviceRouteOptions {
  registerDevice: (userId: string, input: DeviceInput) => Promise<void>;
}

/** `registerDevice` del contrato: alta o refresco del token FCM del dispositivo de la cuenta propia. */
export function deviceRoutes(options: DeviceRouteOptions): FastifyPluginCallback {
  return (app, _options, done) => {
    app.put(
      '/me/devices',
      { config: { operationId: 'registerDevice' } },
      async (request, reply) => {
        const input = validated(validateDeviceInput(request.body));
        await options.registerDevice(accountId(request), input);
        return reply.code(204).send();
      },
    );
    done();
  };
}
