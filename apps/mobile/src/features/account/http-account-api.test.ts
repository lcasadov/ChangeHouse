import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';

import { createApiClient } from '../../api/client';
import { FakeBackend, me } from '../../test-support/fake-backend';
import { AccountApiError } from './account-api';
import { createHttpAccountApi } from './http-account-api';

function setup(backend: FakeBackend) {
  return createHttpAccountApi(
    createApiClient({
      baseUrl: 'https://api.test',
      getToken: () => Promise.resolve('token'),
      fetch: backend.fetch,
    }),
  );
}

const input = {
  displayName: 'Ana',
  acceptedTermsVersion: TERMS_VERSION,
  acceptedPrivacyVersion: PRIVACY_VERSION,
};

async function kindOf(action: Promise<unknown>): Promise<string> {
  try {
    await action;
  } catch (error) {
    return error instanceof AccountApiError ? error.kind : 'otro-error';
  }
  return 'sin-error';
}

describe('getMe', () => {
  it('devuelve el perfil de la cuenta (GET /me)', async () => {
    const backend = new FakeBackend({ registered: true, profile: me({ displayName: 'Lucía' }) });

    const profile = await setup(backend).getMe();

    expect(profile).toMatchObject({ displayName: 'Lucía', roles: ['seeker'] });
    expect(backend.requests).toMatchObject([{ method: 'GET', path: '/me' }]);
  });

  it('devuelve null si la persona aún no se ha dado de alta (404)', async () => {
    expect(await setup(new FakeBackend({ registered: false })).getMe()).toBeNull();
  });

  it.each([
    ['unauthorized', 'unauthorized'],
    ['server', 'server'],
    ['network', 'network'],
  ] as const)('traduce el fallo %s a %s', async (failure, kind) => {
    const backend = new FakeBackend({ registered: true });
    backend.failNext = failure;

    expect(await kindOf(setup(backend).getMe())).toBe(kind);
  });
});

describe('upsertMe', () => {
  it('envía PUT /me con el cuerpo y devuelve el perfil creado (201)', async () => {
    const backend = new FakeBackend({ registered: false });

    const profile = await setup(backend).upsertMe(input);

    expect(profile.displayName).toBe('Ana');
    expect(backend.requests).toEqual([
      { method: 'PUT', path: '/me', authorization: 'Bearer token', body: input },
    ]);
  });

  it('también acepta el perfil actualizado (200)', async () => {
    const backend = new FakeBackend({ registered: true });

    const profile = await setup(backend).upsertMe({ displayName: 'Ana María' });

    expect(profile.displayName).toBe('Ana María');
  });

  it.each([
    ['legal-outdated', 'legal-acceptance'],
    ['invalid', 'invalid'],
    ['unauthorized', 'unauthorized'],
    ['server', 'server'],
    ['network', 'network'],
  ] as const)('traduce el fallo %s a %s', async (failure, kind) => {
    const backend = new FakeBackend({ registered: false });
    backend.failNext = failure;

    expect(await kindOf(setup(backend).upsertMe(input))).toBe(kind);
  });
});

describe('registerDevice', () => {
  it('registra el token y el sistema del dispositivo (PUT /me/devices)', async () => {
    const backend = new FakeBackend({ registered: true });

    await setup(backend).registerDevice({ fcmToken: 'fcm-1', platform: 'android' });

    expect(backend.requests).toMatchObject([
      { method: 'PUT', path: '/me/devices', body: { fcmToken: 'fcm-1', platform: 'android' } },
    ]);
  });

  it.each([
    ['unauthorized', 'unauthorized'],
    ['invalid', 'invalid'],
    ['server', 'server'],
    ['network', 'network'],
  ] as const)('traduce el fallo %s a %s', async (failure, kind) => {
    const backend = new FakeBackend({ registered: true });
    backend.failNext = failure;

    expect(
      await kindOf(setup(backend).registerDevice({ fcmToken: 'fcm-1', platform: 'ios' })),
    ).toBe(kind);
  });
});

describe('deleteMe', () => {
  it('elimina la cuenta (DELETE /me)', async () => {
    const backend = new FakeBackend({ registered: true });

    await setup(backend).deleteMe();

    expect(backend.requests).toMatchObject([{ method: 'DELETE', path: '/me' }]);
    expect(backend.deleted).toBe(true);
  });

  it.each([
    ['unauthorized', 'unauthorized'],
    ['server', 'server'],
    ['network', 'network'],
  ] as const)('un fallo %s se normaliza a %s', async (failure, kind) => {
    const backend = new FakeBackend({ registered: true });
    backend.failNext = failure;

    expect(await kindOf(setup(backend).deleteMe())).toBe(kind);
    expect(backend.deleted).toBe(false);
  });
});

describe('exportMyData', () => {
  it('devuelve el JSON de la exportación (GET /me/export)', async () => {
    const backend = new FakeBackend({ registered: true, profile: me({ displayName: 'Lucía' }) });

    const data = await setup(backend).exportMyData();

    expect(data).toMatchObject({ account: { displayName: 'Lucía' } });
    expect(backend.requests).toMatchObject([{ method: 'GET', path: '/me/export' }]);
  });

  it.each([
    ['unauthorized', 'unauthorized'],
    ['server', 'server'],
    ['network', 'network'],
  ] as const)('un fallo %s se normaliza a %s', async (failure, kind) => {
    const backend = new FakeBackend({ registered: true });
    backend.failNext = failure;

    expect(await kindOf(setup(backend).exportMyData())).toBe(kind);
  });
});
