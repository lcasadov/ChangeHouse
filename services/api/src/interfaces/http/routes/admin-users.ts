import { type SuspensionInput, validateSuspensionInput } from '@changehouse/shared';
import type { FastifyPluginCallback } from 'fastify';

import { UserToModerateNotFoundError } from '../../../application/moderation/errors.js';
import type { AdminUserView } from '../../../application/moderation/user-suspension.js';
import { accountId, uuidOr404, validated } from './request-helpers.js';

export interface AdminUserRouteOptions {
  adminSetUserSuspension: (
    adminId: string,
    userId: string,
    input: SuspensionInput,
  ) => Promise<AdminUserView>;
}

/**
 * `adminSetUserSuspension` del contrato (RF-90, RF-93). Solo transporte: la política central la
 * restringe al rol `admin` y el caso de uso decide, cierra los matches y audita.
 */
export function adminUserRoutes(options: AdminUserRouteOptions): FastifyPluginCallback {
  return (app, _options, done) => {
    app.put<{ Params: { userId: string } }>(
      '/admin/users/:userId/suspension',
      { config: { operationId: 'adminSetUserSuspension' } },
      (request) => {
        const userId = uuidOr404(request.params.userId, () => new UserToModerateNotFoundError());
        const input = validated(validateSuspensionInput(request.body));
        return options.adminSetUserSuspension(accountId(request), userId, input);
      },
    );
    done();
  };
}
