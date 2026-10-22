import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as ExpoHaptics from 'expo-haptics';
import { Image } from 'expo-image';
import { AccessibilityInfo } from 'react-native';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';

import { UNDO_WINDOW_MS } from '../features/discovery/decision-model';
import es from '../i18n/locales/es-ES.json';
import {
  button,
  cardWith,
  openExplore,
  published,
  SEEKER,
  zoneCards,
} from '../test-support/explore-harness';
import type { FakeBackend } from '../test-support/fake-backend';

// Flujos completos de la app (rutas, consultas y API simulada): el primero carga todos los módulos
jest.setTimeout(30_000);

const d = es.discovery;
const a = d.actions;
const m = d.decision;
const SAVE_TIMEOUT = { timeout: 4000 };

let announce: jest.SpyInstance;

beforeEach(() => {
  jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockReturnValue();
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

const likes = (backend: FakeBackend) => backend.requestsTo('POST', '/me/likes');
const dismissals = (backend: FakeBackend) => backend.requestsTo('POST', '/me/dismissals');
const undos = (backend: FakeBackend) => backend.requestsTo('DELETE', '/me/last-action');
const discoverRequests = (backend: FakeBackend) => backend.requestsTo('GET', '/discover');
const decisionBar = () => screen.getByTestId('decision-bar');
const isDisabled = (name: string) => button(name).props.accessibilityState as { disabled: boolean };

/** Un deslizamiento del dedo sobre la tarjeta de delante, más allá del umbral del 30 % del ancho. */
function swipe(distance: number) {
  const controller = createGestureController('card-swipe');
  controller.begin();
  controller.activate();
  controller.update({ translationX: distance });
  controller.end({ translationX: distance });
}

describe('Me gusta desde una vivienda propia', () => {
  it('Scenario: Me gusta válido - la tarjeta sale al instante, se registra desde mi vivienda y se anuncia', async () => {
    const cards = zoneCards(3);
    const { backend, homeId } = await openExplore({ cards });
    await cardWith('Zona 1');
    const release = backend.hold();

    await fireEvent.press(button(a.like));

    // Optimista: la siguiente ya está a la vista aunque la API aún no ha respondido
    expect(await cardWith('Zona 2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Piso en Zona 1/ })).toBeNull();
    await waitFor(() => {
      expect(likes(backend)).toHaveLength(1);
    });
    expect(likes(backend)[0]?.body).toEqual({ fromHomeId: homeId, targetHomeId: cards[0]?.id });
    expect(announce).not.toHaveBeenCalled();

    release();

    await waitFor(() => {
      expect(announce).toHaveBeenCalledWith(m.liked);
    });
    expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(
      ExpoHaptics.NotificationFeedbackType.Success,
    );
    expect(within(decisionBar()).getByText(m.liked)).toBeTruthy();
    expect(backend.decisions.actions).toHaveLength(1);
  });

  it('la tarjeta que gusta sale de las páginas ya cargadas sin volver a pedirlas', async () => {
    const { backend } = await openExplore();
    await cardWith('Zona 1');

    await fireEvent.press(button(a.like));
    await cardWith('Zona 2');

    expect(discoverRequests(backend)).toHaveLength(1);
  });

  it('Scenario: Usuario sin vivienda publicada - invita a publicar la suya y no llama a la API', async () => {
    const { backend } = await openExplore({ profile: SEEKER, homes: [] });
    await cardWith('Zona 1');

    await fireEvent.press(button(a.like));

    expect(await screen.findByRole('header', { name: d.publishSheet.title })).toBeTruthy();
    expect(screen.getByText(d.publishSheet.message)).toBeTruthy();
    expect(likes(backend)).toHaveLength(0);
    expect(backend.requests.filter((request) => request.method !== 'GET')).toHaveLength(0);

    await fireEvent.press(button(d.publishSheet.action));

    expect(await screen.findByRole('header', { name: es.homes.empty.title })).toBeTruthy();
  });

  it('sin vivienda publicada, deslizar a la derecha tampoco llama a la API: abre la invitación y la tarjeta se queda', async () => {
    const { backend } = await openExplore({ profile: SEEKER, homes: [] });
    await cardWith('Zona 1');

    swipe(300);

    expect(await screen.findByRole('header', { name: d.publishSheet.title })).toBeTruthy();
    expect(likes(backend)).toHaveLength(0);
    await fireEvent.press(button(d.publishSheet.close));
    expect(await cardWith('Zona 1')).toBeTruthy();
  });

  it('si la API dice que ya no puede dar me gusta (403), la tarjeta vuelve y se invita a publicar', async () => {
    const { backend } = await openExplore();
    await cardWith('Zona 1');
    backend.decisions.rejectNext('like', 403);

    await fireEvent.press(button(a.like));

    expect(await screen.findByRole('header', { name: d.publishSheet.title })).toBeTruthy();
    await fireEvent.press(button(d.publishSheet.close));
    expect(await cardWith('Zona 1')).toBeTruthy();
  });

  it('Scenario: Undécimo me gusta del día - la tarjeta vuelve, dice cuándo podrá seguir y deja descartar', async () => {
    const cards = zoneCards(4);
    const { backend } = await openExplore({ cards });
    backend.decisions.likesPerDay = 1;
    await cardWith('Zona 1');
    await fireEvent.press(button(a.like));
    await cardWith('Zona 2');

    await fireEvent.press(button(a.like));

    expect(await cardWith('Zona 2')).toBeTruthy();
    const message = await screen.findByText(/Has usado todos tus me gusta de hoy/);
    expect(message.props.children).toMatch(/Podrás seguir a las \d{2}:\d{2}\./);
    expect(likes(backend)).toHaveLength(2);
    expect(backend.decisions.likesGiven()).toBe(1);
    // Descartar sigue permitido
    await fireEvent.press(button(a.dismiss));
    expect(await cardWith('Zona 3')).toBeTruthy();
    expect(dismissals(backend)).toHaveLength(1);
  });

  it('un 429 sin tiempo conocido dice que podrá seguir mañana', async () => {
    const { backend } = await openExplore();
    await cardWith('Zona 1');
    backend.decisions.rejectNext('like', 429, { code: 'DAILY_LIKE_LIMIT' });

    await fireEvent.press(button(a.like));

    expect(await screen.findByText(m.errors.dailyLimitUnknown)).toBeTruthy();
    expect(await cardWith('Zona 1')).toBeTruthy();
  });

  it.each([
    ['un fallo de red', { network: true }, m.errors.network],
    ['un error del servidor (500)', { status: 500 }, m.errors.server],
    [
      'una vivienda de origen que ya no está publicada (409)',
      { status: 409, code: 'HOME_NOT_PUBLISHED' },
      m.errors.homeNotPublished,
    ],
  ] as const)(
    'ante %s tras un me gusta optimista la tarjeta vuelve y se dice qué hacer',
    async (_name, failure, message) => {
      const { backend } = await openExplore();
      await cardWith('Zona 1');
      if ('network' in failure) backend.failNext = 'network';
      else
        backend.decisions.rejectNext(
          'like',
          failure.status,
          'code' in failure ? { code: failure.code } : {},
        );

      await fireEvent.press(button(a.like));

      expect(await screen.findByText(message)).toBeTruthy();
      expect(await cardWith('Zona 1')).toBeTruthy();
      expect(isDisabled(a.undo).disabled).toBe(true);
      expect(announce).not.toHaveBeenCalledWith(m.liked);
    },
  );

  it('si la casa ya no existe (404) la tarjeta no vuelve y se explica', async () => {
    const { backend } = await openExplore();
    await cardWith('Zona 1');
    backend.decisions.rejectNext('like', 404);

    await fireEvent.press(button(a.like));

    expect(await screen.findByText(m.errors.gone)).toBeTruthy();
    expect(await cardWith('Zona 2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Piso en Zona 1/ })).toBeNull();
  });

  it('un me gusta que ya existía (409) deja la tarjeta fuera sin mostrar ningún error', async () => {
    const { backend } = await openExplore();
    await cardWith('Zona 1');
    backend.decisions.rejectNext('like', 409, { code: 'LIKE_EXISTS' });

    await fireEvent.press(button(a.like));

    expect(await cardWith('Zona 2')).toBeTruthy();
    await waitFor(() => {
      expect(likes(backend)).toHaveLength(1);
    });
    expect(screen.queryByText(m.errors.server)).toBeNull();
    expect(screen.queryByText(m.errors.network)).toBeNull();
  });
});

describe('Descartar', () => {
  it('Scenario: Descartar - desaparece, se registra desde mi vivienda y no vuelve al cambiar la búsqueda', async () => {
    const cards = zoneCards(3);
    const { backend, homeId } = await openExplore({ cards });
    await cardWith('Zona 1');

    await fireEvent.press(button(a.dismiss));

    expect(await cardWith('Zona 2')).toBeTruthy();
    await waitFor(() => {
      expect(dismissals(backend)).toHaveLength(1);
    });
    expect(dismissals(backend)[0]?.body).toEqual({
      fromHomeId: homeId,
      targetHomeId: cards[0]?.id,
    });
    await waitFor(() => {
      expect(announce).toHaveBeenCalledWith(m.dismissed);
    });
    expect(within(decisionBar()).getByText(m.dismissed)).toBeTruthy();

    // Otra búsqueda: la API no vuelve a ofrecer la casa descartada
    await fireEvent.press(button(es.search.chips.garage));
    await waitFor(() => {
      expect(discoverRequests(backend)).toHaveLength(2);
    }, SAVE_TIMEOUT);
    expect(await cardWith('Zona 2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Piso en Zona 1/ })).toBeNull();
  });

  it('un buscador sin vivienda también descarta, desde su cuenta', async () => {
    const cards = zoneCards(2);
    const { backend } = await openExplore({ profile: SEEKER, homes: [], cards });
    await cardWith('Zona 1');

    await fireEvent.press(button(a.dismiss));

    expect(await cardWith('Zona 2')).toBeTruthy();
    await waitFor(() => {
      expect(dismissals(backend)).toHaveLength(1);
    });
    expect(dismissals(backend)[0]?.body).toEqual({ targetHomeId: cards[0]?.id });
  });

  it('si falla al descartar, la tarjeta vuelve y se dice qué hacer', async () => {
    const { backend } = await openExplore();
    await cardWith('Zona 1');
    backend.decisions.rejectNext('dismiss', 500);

    await fireEvent.press(button(a.dismiss));

    expect(await screen.findByText(m.errors.server)).toBeTruthy();
    expect(await cardWith('Zona 1')).toBeTruthy();
    expect(isDisabled(a.undo).disabled).toBe(true);
  });

  it('descartar la última casa deja el final de la lista y aún se puede deshacer', async () => {
    await openExplore({ cards: zoneCards(1) });
    await cardWith('Zona 1');

    await fireEvent.press(button(a.dismiss));

    expect(await screen.findByRole('header', { name: d.end.title })).toBeTruthy();
    expect(isDisabled(a.dismiss).disabled).toBe(true);
    expect(isDisabled(a.like).disabled).toBe(true);
    await waitFor(() => {
      expect(isDisabled(a.undo).disabled).toBe(false);
    });

    await fireEvent.press(button(a.undo));

    expect(await cardWith('Zona 1')).toBeTruthy();
  });
});

describe('Deshacer la última acción', () => {
  it('Scenario: Deshacer un descarte - la tarjeta vuelve a la cima de la pila y el descarte deja de existir', async () => {
    const cards = zoneCards(3);
    const { backend, homeId } = await openExplore({ cards });
    await cardWith('Zona 1');
    await fireEvent.press(button(a.dismiss));
    await cardWith('Zona 2');
    await waitFor(() => {
      expect(isDisabled(a.undo).disabled).toBe(false);
    });

    await fireEvent.press(button(a.undo));

    expect(await cardWith('Zona 1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Piso en Zona 2/ })).toBeNull();
    await waitFor(() => {
      expect(undos(backend)).toHaveLength(1);
    });
    expect(undos(backend)[0]?.search).toBe(`?homeId=${homeId}`);
    expect(backend.decisions.actions).toEqual([]);
    expect(isDisabled(a.undo).disabled).toBe(true);
    expect(screen.queryByTestId('decision-bar')).toBeNull();
    // Y la casa recuperada se puede volver a decidir
    await fireEvent.press(button(a.like));
    expect(await cardWith('Zona 2')).toBeTruthy();
    expect(likes(backend)[0]?.body).toMatchObject({ targetHomeId: cards[0]?.id });
  });

  it('deshacer un me gusta devuelve la tarjeta y el cupo', async () => {
    const { backend } = await openExplore();
    backend.decisions.likesPerDay = 1;
    await cardWith('Zona 1');
    await fireEvent.press(button(a.like));
    await cardWith('Zona 2');
    await waitFor(() => {
      expect(backend.decisions.likesGiven()).toBe(1);
    });

    await fireEvent.press(button(a.undo));

    expect(await cardWith('Zona 1')).toBeTruthy();
    expect(backend.decisions.likesGiven()).toBe(0);
  });

  it('un buscador deshace desde su cuenta, sin indicar vivienda', async () => {
    const { backend } = await openExplore({ profile: SEEKER, homes: [] });
    await cardWith('Zona 1');
    await fireEvent.press(button(a.dismiss));
    await cardWith('Zona 2');

    await fireEvent.press(button(a.undo));

    expect(await cardWith('Zona 1')).toBeTruthy();
    expect(undos(backend)[0]?.search).toBeUndefined();
  });

  it('Deshacer espera a que la API haya registrado la decisión antes de pedir que se deshaga', async () => {
    const { backend } = await openExplore();
    await cardWith('Zona 1');
    const release = backend.hold();
    await fireEvent.press(button(a.dismiss));
    await cardWith('Zona 2');
    await waitFor(() => {
      expect(dismissals(backend)).toHaveLength(1);
    });

    await fireEvent.press(button(a.undo));
    expect(undos(backend)).toHaveLength(0);
    release();

    expect(await cardWith('Zona 1')).toBeTruthy();
    expect(undos(backend)).toHaveLength(1);
    expect(backend.decisions.actions).toEqual([]);
  });

  it('pasados 5 segundos la barra desaparece y ya no se puede deshacer', async () => {
    jest.useFakeTimers();
    await openExplore();
    await cardWith('Zona 1');
    await fireEvent.press(button(a.dismiss));
    await cardWith('Zona 2');
    expect(within(decisionBar()).getByText(m.dismissed)).toBeTruthy();
    await waitFor(() => {
      expect(isDisabled(a.undo).disabled).toBe(false);
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(UNDO_WINDOW_MS - 100);
    });
    expect(screen.getByTestId('decision-bar')).toBeTruthy();
    expect(isDisabled(a.undo).disabled).toBe(false);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(200);
    });
    expect(screen.queryByTestId('decision-bar')).toBeNull();
    expect(isDisabled(a.undo).disabled).toBe(true);
  });

  it('una nueva decisión reinicia la cuenta atrás y la barra pasa a hablar de ella', async () => {
    jest.useFakeTimers();
    await openExplore();
    await cardWith('Zona 1');
    await fireEvent.press(button(a.dismiss));
    await cardWith('Zona 2');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(UNDO_WINDOW_MS - 1000);
    });

    await fireEvent.press(button(a.like));
    await cardWith('Zona 3');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(UNDO_WINDOW_MS - 1000);
    });

    expect(within(decisionBar()).getByText(m.liked)).toBeTruthy();
    expect(isDisabled(a.undo).disabled).toBe(false);
  });

  it('Scenario: No se deshace un match - dice que el match se mantiene y la tarjeta no vuelve', async () => {
    const cards = zoneCards(3);
    const { backend, homeId } = await openExplore({ cards });
    backend.decisions.matched.add(`${homeId}>${cards[0]?.id ?? ''}`);
    await cardWith('Zona 1');
    await fireEvent.press(button(a.like));
    await cardWith('Zona 2');
    await waitFor(() => {
      expect(backend.decisions.likesGiven()).toBe(1);
    });

    await fireEvent.press(button(a.undo));

    expect(await screen.findByText(m.errors.likeInMatch)).toBeTruthy();
    expect(await cardWith('Zona 2')).toBeTruthy();
    expect(backend.decisions.actions).toHaveLength(1);
  });

  it('si no se puede deshacer por otro motivo lo dice y la tarjeta no vuelve', async () => {
    const { backend } = await openExplore();
    await cardWith('Zona 1');
    await fireEvent.press(button(a.dismiss));
    await cardWith('Zona 2');
    await waitFor(() => {
      expect(isDisabled(a.undo).disabled).toBe(false);
    });
    backend.decisions.rejectNext('undo', 500);

    await fireEvent.press(button(a.undo));

    expect(await screen.findByText(m.errors.undoFailed)).toBeTruthy();
    expect(await cardWith('Zona 2')).toBeTruthy();
  });
});

describe('Decidir con un gesto', () => {
  it('Scenario: Deslizar a la derecha - registra «Me gusta» y aparece la siguiente tarjeta', async () => {
    const cards = zoneCards(3);
    const { backend, homeId } = await openExplore({ cards });
    await cardWith('Zona 1');

    swipe(300);

    expect(await cardWith('Zona 2')).toBeTruthy();
    await waitFor(() => {
      expect(likes(backend)).toHaveLength(1);
    });
    expect(likes(backend)[0]?.body).toEqual({ fromHomeId: homeId, targetHomeId: cards[0]?.id });
  });

  it('deslizar a la izquierda descarta', async () => {
    const { backend } = await openExplore();
    await cardWith('Zona 1');

    swipe(-300);

    expect(await cardWith('Zona 2')).toBeTruthy();
    await waitFor(() => {
      expect(dismissals(backend)).toHaveLength(1);
    });
  });

  it('un deslizamiento que no llega al umbral no decide nada', async () => {
    const { backend } = await openExplore();
    await cardWith('Zona 1');

    swipe(60);

    expect(await cardWith('Zona 1')).toBeTruthy();
    expect(backend.requests.filter((request) => request.method !== 'GET')).toHaveLength(0);
  });

  it('Scenario: Sin gestos - el botón «Me gusta» registra la acción y se anuncia el resultado', async () => {
    const { backend } = await openExplore();
    await cardWith('Zona 1');

    await fireEvent.press(button(a.like));

    await waitFor(() => {
      expect(announce).toHaveBeenCalledWith(m.liked);
    });
    expect(likes(backend)).toHaveLength(1);
  });

  it('Scenario: Sin gestos - la tarjeta ofrece «Me gusta» y «Descartar» como acciones de accesibilidad', async () => {
    const { backend } = await openExplore();
    const card = await cardWith('Zona 1');

    expect(card.props.accessibilityActions).toEqual([
      { name: 'like', label: a.like },
      { name: 'dismiss', label: a.dismiss },
    ]);
    await fireEvent(card, 'accessibilityAction', { nativeEvent: { actionName: 'dismiss' } });

    expect(await cardWith('Zona 2')).toBeTruthy();
    await waitFor(() => {
      expect(dismissals(backend)).toHaveLength(1);
    });
  });

  it('Scenario: Reducir movimiento - decidir sigue funcionando y la tarjeta se sustituye', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { backend } = await openExplore();
    await cardWith('Zona 1');

    await fireEvent.press(button(a.like));

    expect(await cardWith('Zona 2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Piso en Zona 1/ })).toBeNull();
    await waitFor(() => {
      expect(likes(backend)).toHaveLength(1);
    });
  });
});

describe('Paginación al decidir', () => {
  it('pide la siguiente página al quedar pocas tarjetas y no repite ninguna', async () => {
    const { backend } = await openExplore({ cards: zoneCards(8), pageSize: 5 });
    const seen: string[] = [];

    for (let position = 1; position <= 8; position += 1) {
      const card = await cardWith(`Zona ${String(position)}`);
      seen.push((card.props.accessibilityLabel as string).split('.')[0] ?? '');
      if (position < 8) await fireEvent.press(button(a.dismiss));
    }

    expect(new Set(seen).size).toBe(8);
    expect(discoverRequests(backend)).toHaveLength(2);
    await fireEvent.press(button(a.dismiss));
    expect(await screen.findByRole('header', { name: d.end.title })).toBeTruthy();
    expect(dismissals(backend)).toHaveLength(8);
  });
});

describe('Tema', () => {
  it.each(['light', 'dark'] as const)(
    'los botones de decisión se ven en el tema %s',
    async (theme) => {
      await openExplore({ theme, homes: [published()] });
      await cardWith('Zona 1');

      expect(button(a.dismiss)).toBeTruthy();
      expect(button(a.undo)).toBeTruthy();
      expect(button(a.like)).toBeTruthy();
    },
  );
});
