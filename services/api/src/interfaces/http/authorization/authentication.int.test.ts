import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest';

import {
  emulatorAvailable,
  expiredToken,
  PROJECT_ID,
  signUp,
  tamperedToken,
  withClaims,
} from '../../../../test/auth-emulator.js';
import { FixedHomeOwnership, InMemoryUserRepository } from '../../../../test/fakes.js';
import { openSql, testConfig } from '../../../../test/fixtures.js';
import { captureLogs } from '../../../../test/http.js';
import { resolvePrincipal } from '../../../application/auth/resolve-principal.js';
import { createApi } from '../../../bootstrap.js';
import { createFirebaseIdentityVerifier } from '../../../infrastructure/auth/firebase-identity-verifier.js';
import { buildApp } from '../app.js';

describe.skipIf(!emulatorAvailable())(
  'autenticación con tokens reales del emulador de Auth',
  () => {
    let app: FastifyInstance;
    let closeVerifier: () => Promise<void>;
    const logs = captureLogs();

    beforeAll(() => {
      const identity = createFirebaseIdentityVerifier({
        projectId: PROJECT_ID,
        authEmulatorHost: inject('authEmulatorHost'),
      });
      const { verifier } = identity;
      closeVerifier = identity.close;
      app = buildApp({
        logger: logs.options,
        security: {
          authenticate: (token) =>
            resolvePrincipal(
              {
                verifier,
                users: new InMemoryUserRepository(),
                ownership: new FixedHomeOwnership(),
              },
              token,
            ),
          policy: { whoami: { kind: 'authenticated' } },
        },
      });
      app.get('/whoami', { config: { operationId: 'whoami' } }, (request) => ({
        uid: request.principal?.identity.uid,
        email: request.principal?.identity.email,
        registered: request.principal?.account !== null,
      }));
    });

    afterEach(() => {
      logs.lines.length = 0;
    });

    afterAll(async () => {
      await app.close();
      await closeVerifier();
    });

    const whoami = (authorization?: string) =>
      app.inject({
        method: 'GET',
        url: '/whoami',
        headers: authorization ? { authorization } : {},
      });

    it('Scenario: Petición sin token - 401', async () => {
      expect((await whoami()).statusCode).toBe(401);
    });

    it('Scenario: Token válido - se identifica a la persona y, sin alta, no tiene cuenta', async () => {
      const user = await signUp();

      const response = await whoami(`Bearer ${user.idToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ uid: user.uid, email: user.email, registered: false });
    });

    it('Scenario: Token caducado o manipulado - un token caducado da 401 y el registro no lo contiene', async () => {
      const user = await signUp();
      const expired = expiredToken(user.idToken);

      const response = await whoami(`Bearer ${expired}`);

      expect(response.statusCode).toBe(401);
      expect(logs.text()).not.toContain(expired);
      expect(logs.text()).not.toContain(expired.split('.')[1]);
    });

    it('Scenario: Token caducado o manipulado - con la firma alterada da 401 y el registro no lo contiene', async () => {
      const user = await signUp();
      const tampered = tamperedToken(user.idToken);

      const response = await whoami(`Bearer ${tampered}`);

      expect(response.statusCode).toBe(401);
      expect(logs.text()).not.toContain(tampered);
      expect(logs.text()).not.toContain('firma-alterada');
    });

    it('un token emitido para otro proyecto de Firebase da 401', async () => {
      const user = await signUp();
      const foreign = withClaims(user.idToken, {
        aud: 'otro-proyecto',
        iss: 'https://securetoken.google.com/otro-proyecto',
      });

      expect((await whoami(`Bearer ${foreign}`)).statusCode).toBe(401);
    });

    it('un texto que no es un token da 401', async () => {
      expect((await whoami('Bearer esto-no-es-un-jwt')).statusCode).toBe(401);
    });
  },
);

describe('operación pública con la API completa', () => {
  const sql = openSql();
  let api: ReturnType<typeof createApi>;

  beforeAll(() => {
    api = createApi(testConfig());
  });

  afterAll(async () => {
    await api.close();
    await sql.end();
  });

  it('Scenario: Única operación pública - joinWaitlist sin token sigue respondiendo 202', async () => {
    const response = await api.app.inject({
      method: 'POST',
      url: '/waitlist',
      payload: {
        email: `espera-${String(Date.now())}@example.com`,
        municipality: 'Madrid',
        homeType: 'piso',
        lookingFor: 'Un ático',
        consent: true,
      },
    });

    expect(response.statusCode).toBe(202);
  });
});
