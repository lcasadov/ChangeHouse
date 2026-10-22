import {
  type ConsentInput,
  type MeInput,
  validateConsentInput,
  validateMeInput,
  type Validation,
} from '@changehouse/shared';
import type { FastifyPluginCallback, FastifyRequest } from 'fastify';

import type { Me } from '../../../application/account/me.js';
import type { UpsertMeCommand, UpsertMeResult } from '../../../application/account/upsert-me.js';
import type { Consent } from '../../../domain/account/consent.js';
import { ValidationFailedError } from '../problem.js';

export interface AccountRouteOptions {
  getMe: (userId: string) => Promise<Me>;
  upsertMe: (command: UpsertMeCommand) => Promise<UpsertMeResult>;
  listMyConsents: (userId: string) => Promise<Consent[]>;
  acceptConsent: (userId: string, input: ConsentInput) => Promise<Consent>;
}

/** `Consent` del contrato: la fecha viaja en ISO 8601. */
function toConsentDto(consent: Consent) {
  return {
    type: consent.type,
    version: consent.version,
    acceptedAt: consent.acceptedAt.toISOString(),
  };
}

/** Datos válidos o un 400 con los campos erróneos. */
function validated<T>(result: Validation<T>): T {
  if (result.success) return result.data;
  throw new ValidationFailedError(
    result.errors.map((error) => ({ field: error.field, message: error.code })),
  );
}

/** Id de la cuenta propia; la política ya garantizó que existe en las operaciones que lo piden. */
function accountId(request: FastifyRequest): string {
  const account = request.principal?.account;
  if (!account) throw new Error('La operación exige una cuenta y la política no lo comprobó');
  return account.userId;
}

/**
 * `getMe`, `upsertMe`, `listMyConsents` y `acceptConsent` del contrato: la cuenta propia y sus
 * consentimientos (RF-04). Solo transporte; el acceso lo decide la política central.
 */
export function accountRoutes(options: AccountRouteOptions): FastifyPluginCallback {
  return (app, _options, done) => {
    app.get('/me', { config: { operationId: 'getMe' } }, (request) =>
      options.getMe(accountId(request)),
    );

    app.put('/me', { config: { operationId: 'upsertMe' } }, async (request, reply) => {
      const input: MeInput = validated(validateMeInput(request.body));
      const identity = request.principal?.identity;
      if (!identity) throw new Error('La operación exige identidad y la política no lo comprobó');

      const { created, me } = await options.upsertMe({ identity, input });
      return reply.code(created ? 201 : 200).send(me);
    });

    app.get('/me/consents', { config: { operationId: 'listMyConsents' } }, async (request) => {
      const consents = await options.listMyConsents(accountId(request));
      return consents.map(toConsentDto);
    });

    app.post(
      '/me/consents',
      { config: { operationId: 'acceptConsent' } },
      async (request, reply) => {
        const input = validated(validateConsentInput(request.body));
        const consent = await options.acceptConsent(accountId(request), input);
        return reply.code(201).send(toConsentDto(consent));
      },
    );
    done();
  };
}
