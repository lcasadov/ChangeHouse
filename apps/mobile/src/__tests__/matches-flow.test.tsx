import { themes } from '@changehouse/ui';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as ExpoHaptics from 'expo-haptics';
import { Image } from 'expo-image';
import { AccessibilityInfo, processColor } from 'react-native';

import { formatEuros } from '../features/homes/home-form';
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
import { fakeChainMatch, fakeMatch } from '../test-support/fake-matches';
import { styleOf } from '../test-utils';

// Flujos completos de la app (rutas, consultas y API simulada): el primero carga todos los módulos
jest.setTimeout(30_000);

const mt = es.matches;
const c = mt.celebration;
const a = es.discovery.actions;
const m = es.discovery.decision;

let announce: jest.SpyInstance;

beforeEach(() => {
  jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockReturnValue();
});

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

type Row = Parameters<typeof within>[0];

const listRequests = (backend: FakeBackend) => backend.requestsTo('GET', '/matches');
const rows = () => screen.getAllByTestId('match-row');
const pay = (cents: number) => `Tú pagas ${formatEuros(cents)}`;
const receive = (cents: number) => `Tú recibes ${formatEuros(cents)}`;
const isDisabled = (name: string) => button(name).props.accessibilityState as { disabled: boolean };

/** Un match por cada casa, del primero al último, con fechas crecientes. */
const matchesWith = (homeId: string, cards: ReturnType<typeof zoneCards>) =>
  cards.map((card, index) =>
    fakeMatch({
      mineHomeId: homeId,
      theirHomeId: card.id,
      createdAt: `2026-10-0${String(index + 1)}T10:00:00.000Z`,
    }),
  );

/** Una persona con una casa publicada y tres casas de «Zona n» que ofrece «Explorar». */
async function setup(options: Parameters<typeof openExplore>[0] = {}) {
  const home = published();
  const cards = zoneCards(3);
  const opened = await openExplore({ homes: [home], cards, ...options });
  return { ...opened, home, cards };
}

describe('Celebración del match', () => {
  it('Scenario: Match al dar me gusta - aparece la celebración con «Ver match» y se anuncia «¡Tenéis un match!»', async () => {
    const { backend, home, cards } = await setup();
    backend.matches.closeOnLike(home.id, cards[0]?.id ?? '', 1_200_000);
    await cardWith('Zona 1');

    await fireEvent.press(button(a.like));

    expect(await screen.findByRole('header', { name: c.title })).toBeTruthy();
    expect(button(c.view)).toBeTruthy();
    expect(button(c.continue)).toBeTruthy();
    await waitFor(() => {
      expect(announce).toHaveBeenCalledWith(c.title);
    });
    expect(announce).not.toHaveBeenCalledWith(m.liked);
    expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(
      ExpoHaptics.NotificationFeedbackType.Success,
    );
  });

  it('muestra las dos casas, la compensación del usuario y la estimación orientativa', async () => {
    const { backend, home, cards } = await setup();
    backend.matches.closeOnLike(home.id, cards[0]?.id ?? '', -800_000);
    await cardWith('Zona 1');

    await fireEvent.press(button(a.like));
    await screen.findByRole('header', { name: c.title });

    expect(screen.getByTestId('match-cover-mine').props.source).toEqual([
      { uri: home.photos?.[0]?.url },
    ]);
    expect(screen.getByTestId('match-cover-theirs').props.source).toEqual([
      { uri: cards[0]?.photos[0]?.url },
    ]);
    expect(screen.getByText(receive(800_000))).toBeTruthy();
    // La tarjeta que queda detrás también lleva la estimación: se mira solo dentro de la celebración
    const celebration = within(screen.getByTestId('match-celebration'));
    expect(celebration.getByText(es.discovery.compensation.disclaimer)).toBeTruthy();
    expect(celebration.getByText(/ por Piso en Zona 1/)).toBeTruthy();
  });

  it('un me gusta sin match no abre ninguna celebración', async () => {
    await setup();
    await cardWith('Zona 1');

    await fireEvent.press(button(a.like));

    expect(await cardWith('Zona 2')).toBeTruthy();
    await waitFor(() => {
      expect(announce).toHaveBeenCalledWith(m.liked);
    });
    expect(screen.queryByRole('header', { name: c.title })).toBeNull();
  });

  it('«Seguir explorando» cierra la celebración y deja la siguiente tarjeta; el match ya no se puede deshacer', async () => {
    const { backend, home, cards, view } = await setup();
    backend.matches.closeOnLike(home.id, cards[0]?.id ?? '');
    await cardWith('Zona 1');
    await fireEvent.press(button(a.like));
    await screen.findByRole('header', { name: c.title });

    await fireEvent.press(button(c.continue));

    await waitFor(() => {
      expect(screen.queryByRole('header', { name: c.title })).toBeNull();
    });
    expect(await cardWith('Zona 2')).toBeTruthy();
    expect(isDisabled(a.undo).disabled).toBe(true);
    expect(view.getPathname()).toBe('/');
  });

  it('«Ver match» lleva al detalle del match nuevo y «Matches» lo muestra el primero sin recargar a mano', async () => {
    const home = published();
    const cards = zoneCards(3);
    const older = fakeMatch({
      mineHomeId: home.id,
      theirHomeId: cards[2]?.id ?? '',
      compensationCents: -300_000,
      createdAt: '2026-10-01T10:00:00.000Z',
    });
    const { backend, view } = await openExplore({ homes: [home], cards, matches: [older] });
    // Se visita «Matches» antes: el nuevo match debe aparecer en una lista que ya estaba cargada
    await fireEvent.press(await screen.findByRole('button', { name: es.tabs.matches }));
    await screen.findByRole('header', { name: mt.title });
    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });
    await fireEvent.press(screen.getByRole('button', { name: es.tabs.explore }));
    backend.matches.closeOnLike(home.id, cards[0]?.id ?? '', 1_200_000);
    await cardWith('Zona 1');
    await fireEvent.press(button(a.like));
    await screen.findByRole('header', { name: c.title });

    await fireEvent.press(button(c.view));

    const created = backend.matches.all()[0];
    expect(view.getPathname()).toBe(`/match/${created?.id ?? ''}`);
    expect(
      await screen.findByRole('header', { name: mt.detail.title.replace('{{names}}', 'Beto') }),
    ).toBeTruthy();
    expect(screen.queryByRole('header', { name: c.title })).toBeNull();

    await fireEvent.press(button(mt.detail.back));

    await waitFor(() => {
      expect(rows()).toHaveLength(2);
    });
    const [first, second] = rows() as [Row, Row];
    expect(await within(first).findByText(/Piso en Zona 1/)).toBeTruthy();
    expect(within(first).getByText(pay(1_200_000))).toBeTruthy();
    expect(await within(second).findByText(/Piso en Zona 3/)).toBeTruthy();
  });

  it.each(['light', 'dark'] as const)('la celebración se ve en el tema %s', async (theme) => {
    const { backend, home, cards } = await setup({ theme });
    backend.matches.closeOnLike(home.id, cards[0]?.id ?? '');
    await cardWith('Zona 1');

    await fireEvent.press(button(a.like));

    expect(await screen.findByTestId('match-gradient')).toBeTruthy();
    expect(screen.getByTestId('match-gradient').props.colors).toEqual([
      processColor(themes[theme].color.matchGradientStart),
      processColor(themes[theme].color.matchGradientEnd),
    ]);
  });
});

describe('Pestaña «Matches»', () => {
  it('Scenario: Ver mis matches - ve los dos, el más reciente primero, cada uno con su compensación', async () => {
    const home = published();
    const cards = zoneCards(2);
    const older = fakeMatch({
      mineHomeId: home.id,
      theirHomeId: cards[0]?.id ?? '',
      compensationCents: 1_200_000,
      createdAt: '2026-10-17T10:00:00.000Z',
    });
    const newer = fakeMatch({
      mineHomeId: home.id,
      theirHomeId: cards[1]?.id ?? '',
      compensationCents: -800_000,
      createdAt: '2026-10-19T10:00:00.000Z',
    });
    await openExplore({ homes: [home], cards, matches: [older, newer], url: '/matches' });

    expect(await screen.findByRole('header', { name: mt.title })).toBeTruthy();
    await waitFor(() => {
      expect(rows()).toHaveLength(2);
    });
    const [first, second] = rows() as [Row, Row];
    expect(within(first).getByText(/Piso en Zona 2/)).toBeTruthy();
    expect(within(first).getByText(receive(800_000))).toBeTruthy();
    expect(within(second).getByText(/Piso en Zona 1/)).toBeTruthy();
    expect(within(second).getByText(pay(1_200_000))).toBeTruthy();
    expect(within(first).getByText(mt.kind.direct)).toBeTruthy();
    expect(within(first).getByText(mt.status.open)).toBeTruthy();
  });

  it('cada fila lleva la portada de la otra casa y se resume en una sola frase accesible', async () => {
    const home = published();
    const cards = zoneCards(1);
    const match = fakeMatch({
      mineHomeId: home.id,
      theirHomeId: cards[0]?.id ?? '',
      compensationCents: 1_200_000,
    });
    await openExplore({ homes: [home], cards, matches: [match], url: '/matches' });

    const [row] = (await screen.findAllByTestId('match-row')) as [Row];

    await waitFor(() => {
      expect(within(row).getByTestId('match-row-cover').props.source).toEqual([
        { uri: cards[0]?.photos[0]?.url },
      ]);
    });
    const summary = `Piso en Zona 1. ${mt.kind.direct}. ${pay(1_200_000)}. ${mt.status.open}.`;
    expect(screen.getByLabelText(summary)).toBeTruthy();
  });

  it.each([
    ['open', mt.status.open],
    ['confirmed', mt.status.confirmed],
    ['in_operation', mt.status.in_operation],
    ['closed', mt.status.closed],
    ['expired', mt.status.expired],
  ] as const)('el estado %s se dice con texto: «%s»', async (status, label) => {
    const home = published();
    const cards = zoneCards(1);
    const match = fakeMatch({ mineHomeId: home.id, theirHomeId: cards[0]?.id ?? '', status });
    await openExplore({ homes: [home], cards, matches: [match], url: '/matches' });

    expect(await screen.findByText(label)).toBeTruthy();
  });

  it('un match de tres casas se rotula como match en cadena y un cambio justo no lleva importe', async () => {
    const home = published();
    const cards = zoneCards(1);
    const match = fakeMatch({
      mineHomeId: home.id,
      theirHomeId: cards[0]?.id ?? '',
      compensationCents: 0,
      type: 3,
    });
    await openExplore({ homes: [home], cards, matches: [match], url: '/matches' });

    expect(await screen.findByText(mt.kind.chain)).toBeTruthy();
    expect(screen.getByText(es.discovery.compensation.fair)).toBeTruthy();
  });

  it('si la otra casa ya no se puede consultar, la fila lo dice y conserva compensación y estado', async () => {
    const home = published();
    const match = fakeMatch({
      mineHomeId: home.id,
      theirHomeId: '0198f3a0-dddd-7000-8000-000000000001',
      compensationCents: 500_000,
    });
    await openExplore({ homes: [home], cards: [], matches: [match], url: '/matches' });

    expect(await screen.findByText(mt.row.unavailable)).toBeTruthy();
    expect(screen.getByText(pay(500_000))).toBeTruthy();
    expect(screen.getByText(mt.status.open)).toBeTruthy();
  });

  it('Scenario: Sin matches - ve un estado vacío que le anima a seguir explorando', async () => {
    const { view } = await setup({ url: '/matches' });

    expect(await screen.findByRole('header', { name: mt.empty.title })).toBeTruthy();
    expect(screen.getByText(mt.empty.description)).toBeTruthy();

    // «Explorar» es también el nombre de la pestaña: el botón se busca dentro del estado vacío
    await fireEvent.press(
      within(screen.getByTestId('matches-empty')).getByRole('button', { name: mt.empty.action }),
    );

    expect(view.getPathname()).toBe('/');
    expect(await cardWith('Zona 1')).toBeTruthy();
  });

  it('un buscador sin vivienda también ve su lista, vacía', async () => {
    await openExplore({ profile: SEEKER, homes: [], url: '/matches' });

    expect(await screen.findByRole('header', { name: mt.empty.title })).toBeTruthy();
  });

  it('el gesto de refrescar repite la petición y muestra lo nuevo', async () => {
    const home = published();
    const cards = zoneCards(2);
    const first = fakeMatch({ mineHomeId: home.id, theirHomeId: cards[0]?.id ?? '' });
    const { backend } = await openExplore({
      homes: [home],
      cards,
      matches: [first],
      url: '/matches',
    });
    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });
    backend.matches.closeOnLike(home.id, cards[1]?.id ?? '');
    backend.matches.formFor(home.id, cards[1]?.id ?? '');

    const list = screen.getByTestId('matches-list');
    await act(async () => {
      (list.props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(rows()).toHaveLength(2);
    });
    expect(listRequests(backend)).toHaveLength(2);
  });

  it('pide la página siguiente al llegar al final y no repite ninguna', async () => {
    const home = published();
    const cards = zoneCards(3);
    const { backend } = await openExplore({
      homes: [home],
      cards,
      matches: matchesWith(home.id, cards),
      url: '/matches',
    });
    backend.matches.pageSize = 2;
    await screen.findByTestId('matches-list');
    await waitFor(() => {
      expect(rows()).toHaveLength(2);
    });

    await fireEvent(screen.getByTestId('matches-list'), 'endReached');

    await waitFor(() => {
      expect(rows()).toHaveLength(3);
    });
    expect(listRequests(backend)[1]?.search).toBe('?cursor=2');
  });

  it('si falla la página siguiente lo dice y deja reintentar sin perder lo cargado', async () => {
    const home = published();
    const cards = zoneCards(3);
    const { backend } = await openExplore({
      homes: [home],
      cards,
      matches: matchesWith(home.id, cards),
      url: '/matches',
    });
    backend.matches.pageSize = 2;
    await waitFor(() => {
      expect(rows()).toHaveLength(2);
    });
    backend.matches.rejectNext(500);

    await fireEvent(screen.getByTestId('matches-list'), 'endReached');

    expect(await screen.findByText(mt.loadMoreFailed)).toBeTruthy();
    expect(rows()).toHaveLength(2);
    await fireEvent.press(button(mt.retry));
    await waitFor(() => {
      expect(rows()).toHaveLength(3);
    });
  });

  it.each([
    ['un error del servidor', 500],
    ['la falta de permiso', 403],
  ] as const)('ante %s dice qué hacer y «Reintentar» vuelve a pedirla', async (_name, status) => {
    const home = published();
    const cards = zoneCards(1);
    const match = fakeMatch({ mineHomeId: home.id, theirHomeId: cards[0]?.id ?? '' });
    const { backend } = await openExplore({ homes: [home], cards, matches: [match] });
    backend.matches.rejectNext(status);

    await fireEvent.press(await screen.findByRole('button', { name: es.tabs.matches }));

    expect(await screen.findByText(mt.loadFailed)).toBeTruthy();
    await fireEvent.press(button(mt.retry));
    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });
  });

  it.each(['light', 'dark'] as const)('la pestaña usa los tokens del tema %s', async (theme) => {
    const home = published();
    const cards = zoneCards(1);
    const match = fakeMatch({ mineHomeId: home.id, theirHomeId: cards[0]?.id ?? '' });
    await openExplore({ homes: [home], cards, matches: [match], theme, url: '/matches' });

    const title = await screen.findByRole('header', { name: mt.title });

    expect(styleOf(title).color).toBe(themes[theme].color.text);
    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });
  });
});

describe('Match en cadena', () => {
  it('Scenario: Celebración en triángulo - un me gusta que cierra una cadena muestra tres casas y explica quién entrega a quién', async () => {
    const home = published();
    const cards = zoneCards(2);
    const { backend } = await openExplore({ homes: [home], cards });
    backend.matches.closeChainOnLike(home.id, cards[0]?.id ?? '', {
      toHomeId: cards[1]?.id ?? '',
    });
    await cardWith('Zona 1');

    await fireEvent.press(button(a.like));

    expect(await screen.findByRole('header', { name: c.title })).toBeTruthy();
    expect(screen.getByText(mt.chain.label)).toBeTruthy();
    expect(screen.getByText('A tu casa le llega la de Beto, la tuya va a Carla')).toBeTruthy();
    expect(screen.getByTestId('match-cover-mine').props.source).toEqual([
      { uri: home.photos?.[0]?.url },
    ]);
    expect(screen.getByTestId('match-cover-theirs').props.source).toEqual([
      { uri: cards[0]?.photos[0]?.url },
    ]);
    await waitFor(() => {
      expect(screen.getByTestId('match-cover-third').props.source).toEqual([
        { uri: cards[1]?.photos[0]?.url },
      ]);
    });
    expect(screen.getByText(pay(600_000))).toBeTruthy();
    await waitFor(() => {
      expect(announce).toHaveBeenCalledWith(c.title);
    });
    expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(
      ExpoHaptics.NotificationFeedbackType.Success,
    );
  });

  it('la lista rotula la cadena como «Match en cadena» y apila las portadas de las otras dos casas', async () => {
    const home = published();
    const cards = zoneCards(2);
    const match = fakeChainMatch({
      mineHomeId: home.id,
      fromHomeId: cards[0]?.id ?? '',
      toHomeId: cards[1]?.id ?? '',
    });
    await openExplore({ homes: [home], cards, matches: [match], url: '/matches' });

    const [row] = (await screen.findAllByTestId('match-row')) as [Row];

    await waitFor(() => {
      expect(within(row).getByTestId('match-row-cover').props.source).toEqual([
        { uri: cards[0]?.photos[0]?.url },
      ]);
      expect(within(row).getByTestId('match-row-cover-second').props.source).toEqual([
        { uri: cards[1]?.photos[0]?.url },
      ]);
    });
    expect(within(row).getByText('Piso en Zona 1 y Piso en Zona 2')).toBeTruthy();
    expect(within(row).getByText(mt.kind.chain)).toBeTruthy();
    expect(within(row).getByText(pay(600_000))).toBeTruthy();
    const summary = `Piso en Zona 1 y Piso en Zona 2. ${mt.kind.chain}. ${pay(600_000)}. ${mt.status.open}.`;
    expect(screen.getByLabelText(summary)).toBeTruthy();
  });

  it('si una de las otras casas ya no se puede consultar, la fila lo dice sin ocultar el match', async () => {
    const home = published();
    const cards = zoneCards(1);
    const match = fakeChainMatch({
      mineHomeId: home.id,
      fromHomeId: cards[0]?.id ?? '',
      toHomeId: '0198f3a0-dddd-7000-8000-00000000abcd',
    });
    await openExplore({ homes: [home], cards, matches: [match], url: '/matches' });

    expect(await screen.findByText(`Piso en Zona 1 y ${mt.row.unavailable}`)).toBeTruthy();
    expect(screen.getByText(mt.kind.chain)).toBeTruthy();
  });
});
