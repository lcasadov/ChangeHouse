import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Image } from 'expo-image';
import { AccessibilityInfo } from 'react-native';

import es from '../i18n/locales/es-ES.json';
import { button, cardWith, published, zoneCards } from '../test-support/explore-harness';
import { authUser, FakeAuthService } from '../test-support/fake-auth-service';
import { FakeBackend, me } from '../test-support/fake-backend';
import { discoveryCard } from '../test-support/fake-discovery';
import { fakeMatch } from '../test-support/fake-matches';
import { FakePushNotifications, type FakePushOptions } from '../test-support/fake-push';
import { renderSessionApp } from '../test-support/render-session-app';

// Flujos completos de la app (rutas, consultas y API simulada): el primero carga todos los módulos
jest.setTimeout(30_000);

const p = es.notifications.permission;
const like = es.discovery.actions.like;
const OWNER = me({ roles: ['owner'], hasPublishedHome: true });

beforeEach(() => {
  jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockReturnValue();
});

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

const devices = (backend: FakeBackend) => backend.requestsTo('PUT', '/me/devices');
const likes = (backend: FakeBackend) => backend.requestsTo('POST', '/me/likes');
const explanation = () => screen.queryByLabelText(p.title);

/** Una persona con vivienda publicada que abre «Explorar» con un dispositivo de ese tipo. */
async function openExploreWith(options: FakePushOptions = {}) {
  const push = new FakePushNotifications(options);
  const backend = new FakeBackend({
    registered: true,
    profile: OWNER,
    homes: [published()],
    discoveryCards: zoneCards(4),
  });
  const view = await renderSessionApp({
    auth: new FakeAuthService({ initialUser: authUser() }),
    backend,
    pushNotifications: push,
  });
  await cardWith('Zona 1');
  return { push, backend, view };
}

async function giveLike(backend: FakeBackend, expected: number) {
  await fireEvent.press(button(like));
  await waitFor(() => {
    expect(likes(backend)).toHaveLength(expected);
  });
}

describe('Permiso contextual de avisos', () => {
  it('Scenario: Permiso tras el primer me gusta - explica para qué sirven los avisos y, si se concede, registra el dispositivo', async () => {
    const { push, backend } = await openExploreWith();

    // Nunca al abrir la app
    expect(push.requests).toBe(0);
    expect(explanation()).toBeNull();

    await giveLike(backend, 1);

    expect(await screen.findByLabelText(p.title)).toBeTruthy();
    expect(screen.getByText(p.description)).toBeTruthy();
    // La explicación va antes que la petición del sistema
    expect(push.requests).toBe(0);

    await fireEvent.press(button(p.confirm));

    await waitFor(() => {
      expect(devices(backend)).toHaveLength(1);
    });
    expect(push.requests).toBe(1);
    expect(devices(backend)[0]?.body).toEqual({ fcmToken: 'fcm-token-1', platform: 'android' });
    expect(explanation()).toBeNull();
  });

  it('si la persona deniega el permiso del sistema no se registra nada', async () => {
    const { push, backend } = await openExploreWith({ answer: 'denied' });

    await giveLike(backend, 1);
    await fireEvent.press(await screen.findByRole('button', { name: p.confirm }));

    await waitFor(() => {
      expect(push.requests).toBe(1);
    });
    expect(devices(backend)).toHaveLength(0);
  });

  it('con el permiso denegado no se vuelve a explicar ni a pedir en cada me gusta', async () => {
    const { push, backend } = await openExploreWith({ permission: 'denied' });

    await giveLike(backend, 1);
    await giveLike(backend, 2);

    expect(explanation()).toBeNull();
    expect(push.requests).toBe(0);
    expect(devices(backend)).toHaveLength(0);
  });

  it('si rechaza la explicación no se le pide permiso ni se le insiste en el siguiente me gusta', async () => {
    const { push, backend } = await openExploreWith();

    await giveLike(backend, 1);
    await fireEvent.press(await screen.findByRole('button', { name: p.cancel }));
    expect(explanation()).toBeNull();

    await giveLike(backend, 2);

    expect(explanation()).toBeNull();
    expect(push.requests).toBe(0);
    expect(devices(backend)).toHaveLength(0);
  });

  it('con el permiso ya concedido registra el dispositivo sin volver a explicar nada', async () => {
    const { push, backend } = await openExploreWith({ permission: 'granted', platform: 'ios' });

    await giveLike(backend, 1);

    await waitFor(() => {
      expect(devices(backend)).toHaveLength(1);
    });
    expect(devices(backend)[0]?.body).toEqual({ fcmToken: 'fcm-token-1', platform: 'ios' });
    expect(explanation()).toBeNull();
    expect(push.requests).toBe(0);
  });

  it('un me gusta que falla no pide permiso', async () => {
    const { push, backend } = await openExploreWith();
    backend.failNext = 'server';

    await fireEvent.press(button(like));

    await waitFor(() => {
      expect(screen.getByText(es.discovery.decision.errors.server)).toBeTruthy();
    });
    expect(explanation()).toBeNull();
    expect(push.requests).toBe(0);
  });

  it('un fallo al obtener el token no interrumpe a la persona ni registra nada', async () => {
    const { backend } = await openExploreWith({ permission: 'granted', tokenFails: true });

    await giveLike(backend, 1);
    await waitFor(() => {
      expect(screen.getByText(es.discovery.decision.liked)).toBeTruthy();
    });

    expect(devices(backend)).toHaveLength(0);
    expect(screen.queryByText(es.discovery.decision.errors.server)).toBeNull();
  });

  it('en la web, donde no hay push, no se explica ni se pide nada', async () => {
    const { push, backend } = await openExploreWith({ supported: false, platform: 'web' });

    await giveLike(backend, 1);

    expect(explanation()).toBeNull();
    expect(push.requests).toBe(0);
    expect(devices(backend)).toHaveLength(0);
  });

  it('sin token no se registra el dispositivo', async () => {
    const { push, backend } = await openExploreWith({ permission: 'granted', token: null });

    await giveLike(backend, 1);

    expect(devices(backend)).toHaveLength(0);
    expect(push.requests).toBe(0);
  });
});

describe('Navegación al tocar un aviso', () => {
  async function openWithMatch() {
    const push = new FakePushNotifications();
    const home = published();
    const card = discoveryCard({
      location: { visibility: 'area', point: { lat: 40.4, lng: -3.7 }, areaName: 'Zona 1' },
    });
    const match = fakeMatch({ mineHomeId: home.id, theirHomeId: card.id, chatId: 'chat-1' });
    const backend = new FakeBackend({
      registered: true,
      profile: OWNER,
      homes: [home],
      discoveryCards: [card],
      matches: [match],
    });
    const view = await renderSessionApp({
      auth: new FakeAuthService({ initialUser: authUser() }),
      backend,
      pushNotifications: push,
    });
    await cardWith('Zona 1');
    return { push, view, match };
  }

  it.each(['match.created', 'match.confirmed', 'match.closed'])(
    'Scenario: Nuevo match - un aviso %s abre el detalle del match',
    async (type) => {
      const { push, view, match } = await openWithMatch();

      await act(async () => {
        push.tap({ type, matchId: match.id });
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(view.getPathname()).toBe(`/match/${match.id}`);
      });
    },
  );

  it('Scenario: Nuevo mensaje - el aviso abre el chat de ese match', async () => {
    const { push, view, match } = await openWithMatch();

    await act(async () => {
      push.tap({ type: 'message.sent', matchId: match.id });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(view.getPathname()).toBe(`/match/${match.id}/chat`);
    });
  });

  it('un aviso que la app no entiende no cambia de pantalla', async () => {
    const { push, view } = await openWithMatch();

    await act(async () => {
      push.tap({ type: 'otro', matchId: 'x' });
      await Promise.resolve();
    });

    expect(view.getPathname()).toBe('/');
  });
});
