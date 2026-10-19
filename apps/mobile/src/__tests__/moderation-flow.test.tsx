import { FIXTURE_PLACES } from '@changehouse/shared';
import { themes } from '@changehouse/ui';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { Home } from '../features/homes/homes-api';
import es from '../i18n/locales/es-ES.json';
import { authUser, FakeAuthService } from '../test-support/fake-auth-service';
import { FakeBackend, me } from '../test-support/fake-backend';
import { completeHome } from '../test-support/fake-homes';
import { renderSessionApp } from '../test-support/render-session-app';
import { styleOf, THEME_NAMES } from '../test-utils';

// Flujos completos de la app (rutas, formularios y API simulada): el primero carga todos los módulos
jest.setTimeout(30_000);

const { admin: a } = es;

const ADMIN = me({ roles: ['admin'] });
const CHAMBERI = FIXTURE_PLACES[1];
const MALASANA_TITLE = 'Piso en Malasaña';
const CHAMBERI_TITLE = 'Piso en Chamberí';

const button = (name: string) => screen.getByRole('button', { name });
const openCard = (title: string) => a.queue.open.replace('{{title}}', title);
const counter = (position: number, total = 3) =>
  a.detail.photos.counter
    .replace('{{position}}', String(position))
    .replace('{{total}}', String(total));
const photoAlt = (position: number, title: string, total = 3) =>
  a.detail.photos.position
    .replace('{{position}}', String(position))
    .replace('{{total}}', String(total))
    .replace('{{title}}', title);

const inReview = (day: number, overrides: Partial<Home> = {}) =>
  completeHome({
    status: 'in_review',
    createdAt: `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`,
    ...overrides,
  });

const inChamberi = (day: number) =>
  inReview(day, {
    location: {
      visibility: 'area',
      point: CHAMBERI?.areaCenter ?? { lat: 0, lng: 0 },
      areaName: CHAMBERI?.areaName ?? '',
    },
  });

interface OpenOptions {
  homes?: readonly Home[];
  profile?: ReturnType<typeof me>;
  theme?: 'light' | 'dark';
  url?: string;
  backend?: FakeBackend;
}

/** Una persona dada de alta con el rol indicado que abre la app. */
async function openApp({ homes = [], profile = ADMIN, theme, url, backend }: OpenOptions = {}) {
  const auth = new FakeAuthService({ initialUser: authUser() });
  const api = backend ?? new FakeBackend({ registered: true, profile, homes });
  const view = await renderSessionApp({
    auth,
    backend: api,
    ...(theme ? { theme } : {}),
    ...(url ? { url } : {}),
  });
  return { backend: api, view };
}

/** Un admin que abre la pestaña «Administración». */
async function openQueue(options: OpenOptions = {}) {
  const opened = await openApp(options);
  await fireEvent.press(await screen.findByRole('button', { name: es.tabs.admin }));
  return opened;
}

/** Abre el detalle de la vivienda de la cola con ese título. */
async function openDetail(title: string, options: OpenOptions = {}) {
  const opened = await openQueue(options);
  await fireEvent.press(await screen.findByRole('link', { name: openCard(title) }));
  await screen.findByRole('header', { name: title });
  return opened;
}

const posts = (backend: FakeBackend) =>
  backend.requests.filter((request) => request.method === 'POST');

describe('Sección de administración', () => {
  it.each(['owner', 'seeker'] as const)(
    'Scenario: Usuario sin rol de administración - un %s no ve la sección y conserva «Mis casas»',
    async (role) => {
      await openApp({ profile: me({ roles: [role] }) });

      expect(await screen.findByRole('button', { name: es.tabs.homes })).toBeTruthy();
      expect(screen.queryByRole('button', { name: es.tabs.admin })).toBeNull();
    },
  );

  it('Scenario: Usuario sin rol de administración - sus rutas lo devuelven a la pantalla de inicio sin pedir la cola', async () => {
    const { backend } = await openApp({ profile: me({ roles: ['owner'] }), url: '/admin' });

    expect(await screen.findByRole('header', { name: es.discovery.end.title })).toBeTruthy();
    expect(backend.requestsTo('GET', '/admin/homes')).toHaveLength(0);
  });

  it('para el rol admin, «Administración» sustituye a «Mis casas»', async () => {
    await openApp();

    expect(await screen.findByRole('button', { name: es.tabs.admin })).toBeTruthy();
    expect(screen.queryByRole('button', { name: es.tabs.homes })).toBeNull();
    expect(screen.getAllByRole('button', { name: es.tabs.explore })).toHaveLength(1);
  });

  it('un admin que abre «Mis casas» por su ruta no llega a ella: no publica', async () => {
    const { backend } = await openApp({ url: '/homes' });

    expect(await screen.findByRole('header', { name: es.explore.empty.title })).toBeTruthy();
    expect(screen.queryByRole('header', { name: es.homes.title })).toBeNull();
    expect(backend.requestsTo('GET', '/me/homes')).toHaveLength(0);
  });
});

describe('Cola de moderación', () => {
  it('Scenario: Ver la cola - muestra primero la vivienda enviada antes, con zona, tipo, fecha y foto', async () => {
    const newer = inChamberi(12);
    const older = inReview(10);
    const { backend } = await openQueue({
      homes: [newer, older, completeHome({ status: 'draft' })],
    });

    const cards = await screen.findAllByRole('link');
    expect(cards.map((card) => card.props.accessibilityLabel as string)).toEqual([
      openCard(MALASANA_TITLE),
      openCard(CHAMBERI_TITLE),
    ]);
    expect(screen.getByText(a.queue.created.replace('{{date}}', '10 oct 2026'))).toBeTruthy();
    expect(screen.getByText(a.queue.created.replace('{{date}}', '12 oct 2026'))).toBeTruthy();
    expect(screen.getAllByTestId('home-cover')).toHaveLength(2);
    expect(screen.getByRole('header', { name: a.title })).toBeTruthy();
    expect(new URLSearchParams(backend.requests.at(-1)?.search).get('status')).toBe('in_review');
  });

  it('Scenario: Cola vacía - indica que no hay nada pendiente', async () => {
    await openQueue({ homes: [completeHome({ status: 'published' })] });

    expect(await screen.findByRole('header', { name: a.queue.empty.title })).toBeTruthy();
    expect(a.queue.empty.title).toBe('No hay nada pendiente');
    expect(screen.getByText(a.queue.empty.description)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('pagina por cursor: «Cargar más» añade la página siguiente y desaparece al llegar al final', async () => {
    const homes = Array.from({ length: 11 }, (_, index) => inReview(index + 1));
    const { backend } = await openQueue({ homes });

    // La lista pinta por ventanas: lo que importa es qué página pide y qué datos acumula
    expect(await screen.findAllByRole('link')).toHaveLength(10);
    await fireEvent.press(button(a.queue.loadMore));

    await waitFor(() => {
      expect(screen.getByTestId('moderation-queue').props.data).toHaveLength(11);
    });
    expect(new URLSearchParams(backend.requests.at(-1)?.search).get('cursor')).not.toBeNull();
    expect(screen.queryByRole('button', { name: a.queue.loadMore })).toBeNull();
  });

  it('al tirar para refrescar vuelve a pedir la cola y recoge lo nuevo', async () => {
    const { backend } = await openQueue({ homes: [inReview(10)] });
    await screen.findAllByRole('link');
    const home = backend.homes.all()[0];
    if (home) home.status = 'published';

    const list = screen.getByTestId('moderation-queue');
    const control = list.props.refreshControl as { props: { onRefresh: () => void } };
    await act(() => {
      control.props.onRefresh();
    });

    expect(await screen.findByRole('header', { name: a.queue.empty.title })).toBeTruthy();
    expect(backend.requestsTo('GET', '/admin/homes')).toHaveLength(2);
  });

  it('si la cola no carga explica qué hacer y permite reintentar', async () => {
    const backend = new FakeBackend({ registered: true, profile: ADMIN, homes: [inReview(10)] });
    await openApp({ backend });
    const tab = await screen.findByRole('button', { name: es.tabs.admin });
    backend.failNext = 'server';

    await fireEvent.press(tab);

    expect(await screen.findByText(a.queue.loadFailed)).toBeTruthy();
    await fireEvent.press(button(a.queue.retry));
    expect(await screen.findByRole('link', { name: openCard(MALASANA_TITLE) })).toBeTruthy();
    expect(screen.queryByText(a.queue.loadFailed)).toBeNull();
  });

  it.each(THEME_NAMES)('en el tema %s usa los tokens del tema', async (theme) => {
    await openQueue({ theme, homes: [inReview(10)] });

    const title = await screen.findByRole('header', { name: a.title });
    expect(styleOf(title).color).toBe(themes[theme].color.text);
    expect(styleOf(screen.getByText(MALASANA_TITLE)).color).toBe(themes[theme].color.text);
  });
});

describe('Detalle de moderación', () => {
  it('muestra la ficha completa con un carrusel de fotos con texto alternativo, sin la dirección exacta', async () => {
    const home = inReview(10);
    await openDetail(MALASANA_TITLE, { homes: [home] });

    expect(screen.getByLabelText(photoAlt(1, MALASANA_TITLE))).toBeTruthy();
    expect(screen.getByText(counter(1))).toBeTruthy();
    expect(screen.getByText(es.homes.summary.surfaces)).toBeTruthy();
    expect(screen.getByText(es.homes.status.in_review)).toBeTruthy();
    expect(screen.queryByText(home.address)).toBeNull();
    expect(button(a.approve.action)).toBeTruthy();
    expect(button(a.reject.action)).toBeTruthy();
  });

  it('el carrusel avanza y retrocede con botones y anuncia la foto actual', async () => {
    await openDetail(MALASANA_TITLE, { homes: [inReview(10)] });

    await fireEvent.press(button(a.detail.photos.next));
    expect(screen.getByText(counter(2))).toBeTruthy();
    await fireEvent.press(button(a.detail.photos.next));
    await fireEvent.press(button(a.detail.photos.previous));
    expect(screen.getByText(counter(2))).toBeTruthy();
    expect(screen.getByText(counter(2)).props.accessibilityLiveRegion).toBe('polite');
  });

  it('al deslizar el carrusel con el dedo, el contador sigue la foto que queda a la vista', async () => {
    await openDetail(MALASANA_TITLE, { homes: [inReview(10)] });
    const carousel = screen.getByTestId('photo-carousel');

    await fireEvent(carousel, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 200 } },
    });
    await fireEvent(carousel, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 600, y: 0 } },
    });

    expect(screen.getByText(counter(3))).toBeTruthy();
    expect(button(a.detail.photos.next).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(button(a.detail.photos.previous));
    expect(screen.getByText(counter(2))).toBeTruthy();
  });

  it('abre el detalle directamente desde su enlace, buscándolo en la cola', async () => {
    const home = inReview(10);
    await openApp({ homes: [home], url: `/admin/${home.id}` });

    expect(await screen.findByRole('header', { name: MALASANA_TITLE })).toBeTruthy();
  });

  it('una vivienda que ya no está en la cola lo explica y vuelve a la cola', async () => {
    await openApp({ homes: [inReview(10)], url: '/admin/no-esta-en-la-cola' });

    expect(await screen.findByText(a.detail.gone)).toBeTruthy();
    await fireEvent.press(button(a.detail.back));
    expect(await screen.findByRole('link', { name: openCard(MALASANA_TITLE) })).toBeTruthy();
  });

  it('el botón de volver regresa a la cola', async () => {
    await openDetail(MALASANA_TITLE, { homes: [inReview(10)] });

    await fireEvent.press(button(a.detail.back));

    expect(await screen.findByRole('header', { name: a.title })).toBeTruthy();
  });
});

describe('Aprobar', () => {
  it('Scenario: Aprobar - pide confirmación, publica la vivienda y la cola ya no la muestra', async () => {
    const home = inReview(10);
    const { backend } = await openDetail(MALASANA_TITLE, { homes: [home] });

    await fireEvent.press(button(a.approve.action));
    expect(await screen.findByLabelText(a.approve.title)).toBeTruthy();
    expect(posts(backend)).toHaveLength(0);
    await fireEvent.press(button(a.approve.confirm));

    expect(await screen.findByText(a.outcome.approved)).toBeTruthy();
    expect(backend.requestsTo('POST', `/admin/homes/${home.id}/moderation`)).toMatchObject([
      { body: { decision: 'approve' } },
    ]);
    expect(backend.homes.all()[0]).toMatchObject({ status: 'published' });
    expect(screen.queryByRole('button', { name: a.approve.action })).toBeNull();

    await fireEvent.press(button(a.outcome.back));
    expect(await screen.findByRole('header', { name: a.queue.empty.title })).toBeTruthy();
  });

  it('cancelar la confirmación no envía nada', async () => {
    const { backend } = await openDetail(MALASANA_TITLE, { homes: [inReview(10)] });

    await fireEvent.press(button(a.approve.action));
    await fireEvent.press(await screen.findByRole('button', { name: a.approve.cancel }));

    expect(posts(backend)).toHaveLength(0);
    expect(backend.homes.all()[0]).toMatchObject({ status: 'in_review' });
  });

  it('mientras se guarda la decisión, las acciones quedan bloqueadas', async () => {
    const { backend } = await openDetail(MALASANA_TITLE, { homes: [inReview(10)] });
    await fireEvent.press(button(a.approve.action));
    const release = backend.hold();

    await fireEvent.press(await screen.findByRole('button', { name: a.approve.confirm }));

    expect(button(a.approve.action).props.accessibilityState).toMatchObject({ disabled: true });
    expect(button(a.reject.action).props.accessibilityState).toMatchObject({ disabled: true });
    await act(() => {
      release();
    });
    expect(await screen.findByText(a.outcome.approved)).toBeTruthy();
  });

  it('si la red falla lo explica y deja volver a intentarlo', async () => {
    const { backend } = await openDetail(MALASANA_TITLE, { homes: [inReview(10)] });
    await fireEvent.press(button(a.approve.action));
    backend.failNext = 'network';

    await fireEvent.press(await screen.findByRole('button', { name: a.approve.confirm }));

    expect(await screen.findByText(a.failure.network)).toBeTruthy();
    expect(backend.homes.all()[0]).toMatchObject({ status: 'in_review' });
    await fireEvent.press(button(a.approve.action));
    await fireEvent.press(await screen.findByRole('button', { name: a.approve.confirm }));
    expect(await screen.findByText(a.outcome.approved)).toBeTruthy();
    expect(screen.queryByText(a.failure.network)).toBeNull();
  });

  it('si otra persona ya la moderó (409) lo explica y vuelve a una cola actualizada', async () => {
    const { backend } = await openDetail(MALASANA_TITLE, { homes: [inReview(10)] });
    const home = backend.homes.all()[0];
    if (home) home.status = 'published';
    await fireEvent.press(button(a.approve.action));

    await fireEvent.press(await screen.findByRole('button', { name: a.approve.confirm }));

    expect(await screen.findByText(a.outcome.gone)).toBeTruthy();
    expect(screen.queryByRole('button', { name: a.approve.action })).toBeNull();
    await fireEvent.press(button(a.outcome.back));
    expect(await screen.findByRole('header', { name: a.queue.empty.title })).toBeTruthy();
  });
});

describe('Rechazar', () => {
  const sheetField = () => screen.getByLabelText(a.reject.reasonLabel);

  async function openSheet(options: OpenOptions = {}) {
    const opened = await openDetail(MALASANA_TITLE, { homes: [inReview(10)], ...options });
    await fireEvent.press(button(a.reject.action));
    await screen.findByLabelText(a.reject.title);
    return opened;
  }

  it('Scenario: Rechazar con motivo - un motivo frecuente rellena el campo y la vivienda vuelve a borrador con él', async () => {
    const { backend } = await openSheet();
    const reason = a.reject.reasons.photos;

    await fireEvent.press(screen.getByRole('checkbox', { name: reason }));
    expect(sheetField().props.value).toBe(reason);
    await fireEvent.press(button(a.reject.confirm));

    expect(await screen.findByText(a.outcome.rejected)).toBeTruthy();
    expect(posts(backend)).toMatchObject([{ body: { decision: 'reject', reason } }]);
    expect(backend.homes.all()[0]).toMatchObject({ status: 'draft', moderationNote: reason });
    await fireEvent.press(button(a.outcome.back));
    expect(await screen.findByRole('header', { name: a.queue.empty.title })).toBeTruthy();
  });

  it('ofrece los tres motivos frecuentes y el elegido queda marcado', async () => {
    await openSheet();

    for (const reason of Object.values(a.reject.reasons)) {
      expect(screen.getByRole('checkbox', { name: reason })).toBeTruthy();
    }
    await fireEvent.press(screen.getByRole('checkbox', { name: a.reject.reasons.data }));
    expect(
      screen.getByRole('checkbox', { name: a.reject.reasons.data }).props.accessibilityState,
    ).toMatchObject({ checked: true });
    expect(
      screen.getByRole('checkbox', { name: a.reject.reasons.content }).props.accessibilityState,
    ).toMatchObject({ checked: false });
  });

  it('un motivo escrito a mano se envía sin espacios en los extremos', async () => {
    const { backend } = await openSheet();

    await fireEvent.changeText(sheetField(), '  Las fotos están borrosas \n');
    await fireEvent.press(button(a.reject.confirm));

    expect(await screen.findByText(a.outcome.rejected)).toBeTruthy();
    expect(posts(backend)).toMatchObject([
      { body: { decision: 'reject', reason: 'Las fotos están borrosas' } },
    ]);
  });

  it.each(['', '   '])(
    'Scenario: Rechazar sin motivo - un motivo vacío (%j) se señala junto al campo y no envía nada',
    async (text) => {
      const { backend } = await openSheet();

      await fireEvent.changeText(sheetField(), text);
      await fireEvent.press(button(a.reject.confirm));

      expect(await screen.findByText(a.reject.errors.required)).toBeTruthy();
      expect(posts(backend)).toHaveLength(0);
      expect(backend.homes.all()[0]).toMatchObject({ status: 'in_review' });
      expect(screen.getByLabelText(a.reject.title)).toBeTruthy();
    },
  );

  it('el campo limita el motivo a 1000 caracteres', async () => {
    await openSheet();

    expect(sheetField().props.maxLength).toBe(1000);
  });

  it('cancelar cierra la hoja sin rechazar nada', async () => {
    const { backend } = await openSheet();

    await fireEvent.press(button(a.reject.cancel));

    expect(screen.queryByLabelText(a.reject.title)).toBeNull();
    expect(posts(backend)).toHaveLength(0);
    expect(button(a.reject.action)).toBeTruthy();
  });

  it('si el servidor rechaza el motivo (400) lo indica en la hoja, que sigue abierta', async () => {
    const { backend } = await openSheet();
    await fireEvent.changeText(sheetField(), 'Contenido inadecuado');
    backend.failNext = 'invalid';

    await fireEvent.press(button(a.reject.confirm));

    expect(await screen.findByText(a.reject.errors.invalid)).toBeTruthy();
    expect(screen.getByLabelText(a.reject.title)).toBeTruthy();
    expect(sheetField().props.value).toBe('Contenido inadecuado');
  });

  it('si la vivienda ya no está en revisión (409) cierra la hoja y explica que la cola se actualizó', async () => {
    const { backend } = await openSheet();
    const home = backend.homes.all()[0];
    if (home) home.status = 'published';
    await fireEvent.changeText(sheetField(), 'Contenido inadecuado');

    await fireEvent.press(button(a.reject.confirm));

    expect(await screen.findByText(a.outcome.gone)).toBeTruthy();
    expect(screen.queryByLabelText(a.reject.title)).toBeNull();
  });

  it('si la red falla lo explica en la hoja y conserva lo escrito', async () => {
    const { backend } = await openSheet();
    await fireEvent.changeText(sheetField(), 'Contenido inadecuado');
    backend.failNext = 'network';

    await fireEvent.press(button(a.reject.confirm));

    expect(await screen.findByText(a.failure.network)).toBeTruthy();
    expect(sheetField().props.value).toBe('Contenido inadecuado');
  });

  it.each(THEME_NAMES)('en el tema %s la hoja usa los tokens del tema', async (theme) => {
    await openSheet({ theme });

    expect(styleOf(screen.getByText(a.reject.description)).color).toBe(
      themes[theme].color.textMuted,
    );
    expect(styleOf(sheetField()).color).toBe(themes[theme].color.text);
  });
});
