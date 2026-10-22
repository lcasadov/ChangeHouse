import { themes } from '@changehouse/ui';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Image } from 'expo-image';

import { formatEuros } from '../features/homes/home-form';
import type { Home } from '../features/homes/homes-api';
import es from '../i18n/locales/es-ES.json';
import { authUser, FakeAuthService } from '../test-support/fake-auth-service';
import { FakeBackend, me } from '../test-support/fake-backend';
import { type DiscoveryCard as Card, discoveryCard } from '../test-support/fake-discovery';
import { completeHome } from '../test-support/fake-homes';
import { renderSessionApp } from '../test-support/render-session-app';
import { styleOf } from '../test-utils';

// Flujos completos de la app (rutas, consultas y API simulada): el primero carga todos los módulos
jest.setTimeout(30_000);

const d = es.discovery;
const s = es.search;
const SAVE_TIMEOUT = { timeout: 4000 };

const OWNER = me({ roles: ['owner'], hasPublishedHome: true });
const published = (overrides: Partial<Home> = {}) =>
  completeHome({ status: 'published', ...overrides });
const withArea = (areaName: string): Partial<Card> => ({
  location: { visibility: 'area', point: { lat: 40.4, lng: -3.7 }, areaName },
});
const zoneCards = (count: number) =>
  Array.from({ length: count }, (_, index) => discoveryCard(withArea(`Zona ${String(index + 1)}`)));

const button = (name: string) => screen.getByRole('button', { name });
const discoverRequests = (backend: FakeBackend) => backend.requestsTo('GET', '/discover');
const cardWith = async (area: string) =>
  screen.findByRole('button', { name: new RegExp(`Piso en ${area}`) });

interface OpenOptions {
  profile?: ReturnType<typeof me>;
  homes?: readonly Home[];
  cards?: readonly Card[];
  pageSize?: number;
  theme?: 'light' | 'dark';
  url?: string;
  preferences?: null;
}

/** Una persona dada de alta que abre «Explorar» (o la ruta indicada). */
async function open({
  profile = OWNER,
  homes = [published()],
  cards = [],
  pageSize,
  theme,
  url,
  preferences,
}: OpenOptions = {}) {
  const backend = new FakeBackend({
    registered: true,
    profile,
    homes,
    discoveryCards: cards,
    ...(preferences === undefined ? {} : { searchPreferences: preferences }),
  });
  if (pageSize) backend.discovery.pageSize = pageSize;
  const auth = new FakeAuthService({ initialUser: authUser() });
  await renderSessionApp({
    auth,
    backend,
    ...(theme ? { theme } : {}),
    ...(url ? { url } : {}),
  });
  return backend;
}

let prefetch: jest.SpyInstance;

beforeEach(() => {
  prefetch = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Compensación visible en cada tarjeta', () => {
  it('Scenario: El usuario paga - la píldora dice «Tú pagas 12.000 €» con el token compensationPay', async () => {
    const home = published();
    const card = discoveryCard({ compensation: { kind: 'pay', amountCents: 1_200_000 } });
    const backend = await open({ homes: [home], cards: [card] });

    const pill = await screen.findByTestId('compensation-pill');

    expect(screen.getByText(`Tú pagas ${formatEuros(1_200_000)}`)).toBeTruthy();
    expect(styleOf(pill).backgroundColor).toBe(themes.light.color.compensationPay);
    expect(screen.getByText(d.compensation.disclaimer)).toBeTruthy();
    expect(discoverRequests(backend)[0]?.search).toBe(`?homeId=${home.id}`);
  });

  it('Scenario: El usuario paga - en el tema oscuro usa los tokens del tema oscuro', async () => {
    await open({
      cards: [discoveryCard({ compensation: { kind: 'receive', amountCents: 500_000 } })],
      theme: 'dark',
    });

    const pill = await screen.findByTestId('compensation-pill');

    expect(styleOf(pill).backgroundColor).toBe(themes.dark.color.compensationReceive);
  });

  it('Scenario: Cambio justo - la píldora dice «Cambio justo»', async () => {
    await open({ cards: [discoveryCard({ compensation: { kind: 'fair', amountCents: 90_000 } })] });

    await screen.findByTestId('compensation-pill');

    expect(screen.getByText(d.compensation.fair)).toBeTruthy();
    expect(styleOf(screen.getByTestId('compensation-pill')).backgroundColor).toBe(
      themes.light.color.compensationEven,
    );
  });
});

describe('Descubrimiento sin vivienda publicada', () => {
  const seeker = { profile: me(), homes: [] };

  it('Scenario: Buscador mirando - ve viviendas sin píldora y el aviso para publicar la suya', async () => {
    const backend = await open({ ...seeker, cards: zoneCards(2) });

    expect(await cardWith('Zona 1')).toBeTruthy();

    expect(screen.queryByTestId('compensation-pill')).toBeNull();
    expect(screen.getByText(d.seekerNotice.message)).toBeTruthy();
    expect(discoverRequests(backend)[0]?.search).toBeUndefined();
  });

  it('el aviso es permanente y lleva a «Mis casas»', async () => {
    await open({ ...seeker, cards: zoneCards(2) });
    await cardWith('Zona 1');

    await fireEvent.press(button(d.seekerNotice.action));

    expect(await screen.findByRole('header', { name: es.homes.empty.title })).toBeTruthy();
  });

  it('el aviso sigue ahí cuando ya no quedan viviendas', async () => {
    await open({ ...seeker, cards: [] });

    expect(await screen.findByText(d.end.title)).toBeTruthy();
    expect(screen.getByText(d.seekerNotice.message)).toBeTruthy();
  });

  it('un propietario con vivienda publicada no ve el aviso', async () => {
    await open({ cards: zoneCards(1) });
    await cardWith('Zona 1');

    expect(screen.queryByText(d.seekerNotice.message)).toBeNull();
  });
});

describe('Tarjetas a pantalla completa', () => {
  it('una tarjeta a la vista y la siguiente precargada (su primera foto)', async () => {
    const cards = zoneCards(3);
    await open({ cards });
    await cardWith('Zona 1');

    expect(prefetch).toHaveBeenCalledWith(cards[1]?.photos[0]?.url);
    expect(screen.queryByRole('button', { name: /Piso en Zona 2/ })).toBeNull();
  });

  it('al decidir sube la siguiente tarjeta, con la portada de la que viene ya calentada', async () => {
    const cards = zoneCards(3);
    await open({ cards });
    await cardWith('Zona 1');

    await fireEvent.press(button(d.actions.dismiss));

    expect(await cardWith('Zona 2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Piso en Zona 1/ })).toBeNull();
    expect(prefetch).toHaveBeenCalledWith(cards[2]?.photos[0]?.url);
  });

  it('mientras carga reserva el espacio y lo anuncia', async () => {
    const backend = new FakeBackend({
      registered: true,
      profile: OWNER,
      homes: [published()],
      discoveryCards: zoneCards(1),
    });
    const release = backend.holdDiscovery();
    await renderSessionApp({ auth: new FakeAuthService({ initialUser: authUser() }), backend });

    expect(await screen.findByRole('progressbar', { name: d.loading })).toBeTruthy();
    release();

    expect(await cardWith('Zona 1')).toBeTruthy();
    expect(screen.queryByRole('progressbar', { name: d.loading })).toBeNull();
  });

  it('cambiar un filtro de un toque vuelve a pedir las tarjetas', async () => {
    const backend = await open({ cards: zoneCards(2) });
    await cardWith('Zona 1');
    expect(discoverRequests(backend)).toHaveLength(1);

    await fireEvent.press(button(s.chips.garage));

    await waitFor(() => {
      expect(discoverRequests(backend)).toHaveLength(2);
    }, SAVE_TIMEOUT);
    expect(await cardWith('Zona 1')).toBeTruthy();
  });
});

describe('Ver el detalle', () => {
  it('Scenario: Ver el detalle - abre todas las fotos y características, sin dirección postal', async () => {
    const card = discoveryCard({
      ...withArea('Lavapiés'),
      photoCount: 4,
      bedrooms: 3,
      bathrooms: 2,
    });
    await open({ cards: [card] });

    await fireEvent.press(await cardWith('Lavapiés'));

    expect(await screen.findByRole('header', { name: 'Piso en Lavapiés' })).toBeTruthy();
    expect(
      screen.getAllByRole('image', { name: /^Foto \d de 4 de Piso en Lavapiés$/ }),
    ).toHaveLength(4);
    expect(screen.getByText('3 dormitorios')).toBeTruthy();
    expect(screen.getByText('2 baños')).toBeTruthy();
    expect(screen.getByText(es.homes.fields.hasLift)).toBeTruthy();
    expect(screen.getByText(d.detail.location.title)).toBeTruthy();
    expect(
      screen.getByLabelText(
        new RegExp(d.detail.location.areaLabel.replace('{{area}}', 'Lavapiés')),
      ),
    ).toBeTruthy();
    expect(screen.queryByText(es.homes.summary.address)).toBeNull();
  });

  it('Scenario: Detalle de una VPPL - quien cumple los requisitos ve el aviso con el precio máximo legal y los requisitos', async () => {
    const card = discoveryCard({
      ...withArea('Lavapiés'),
      regime: 'VPPL',
      vppMaxLegalPriceCents: 30_000_000,
    });
    await open({ profile: { ...OWNER, meetsVppRequirements: true }, cards: [card] });

    await fireEvent.press(await cardWith('Lavapiés'));
    await screen.findByRole('header', { name: 'Piso en Lavapiés' });

    const v = es.homes.vpp;
    expect(screen.getByText(v.title.replace('{{regime}}', es.homes.regime.VPPL))).toBeTruthy();
    expect(screen.getByText(v.maxLegalPrice.replace('{{amount}}', '300.000 €'))).toBeTruthy();
    expect(screen.getByText(v.authorization)).toBeTruthy();
    expect(screen.getByText(v.requirements)).toBeTruthy();
    expect(screen.getByText(v.rightOfFirstRefusal)).toBeTruthy();
  });

  it('Scenario: Detalle de una VPPL - abierta por su dirección web, el aviso usa la forma pública de la API', async () => {
    const card = discoveryCard({
      ...withArea('Chamberí'),
      regime: 'VPPL',
      vppMaxLegalPriceCents: 30_000_000,
    });
    await open({
      profile: { ...OWNER, meetsVppRequirements: true },
      cards: [card],
      url: `/discover/${card.id}`,
    });

    await screen.findByRole('header', { name: 'Piso en Chamberí' });

    expect(
      screen.getByText(es.homes.vpp.maxLegalPrice.replace('{{amount}}', '300.000 €')),
    ).toBeTruthy();
  });

  it('el detalle de una vivienda libre no muestra el aviso de vivienda protegida', async () => {
    await open({ cards: [discoveryCard(withArea('Lavapiés'))] });

    await fireEvent.press(await cardWith('Lavapiés'));
    await screen.findByRole('header', { name: 'Piso en Lavapiés' });

    expect(screen.queryByText(es.homes.vpp.authorization)).toBeNull();
  });

  it('el detalle repite la compensación estimada de la tarjeta', async () => {
    await open({
      cards: [discoveryCard({ compensation: { kind: 'receive', amountCents: 700_000 } })],
    });

    await fireEvent.press(await screen.findByRole('button', { name: /Piso en Lavapiés/ }));
    await screen.findByRole('header', { name: 'Piso en Lavapiés' });

    expect(screen.getByText(`Tú recibes ${formatEuros(700_000)}`)).toBeTruthy();
  });

  it('abrirlo por su dirección web lo pide a la API y nunca enseña una dirección postal', async () => {
    const card = discoveryCard(withArea('Chamberí'));
    const backend = new FakeBackend({
      registered: true,
      profile: OWNER,
      homes: [published()],
      discoveryCards: [card],
    });
    backend.discovery.leakAddressInDetail('Calle Secreta 1, 28012 Madrid');
    await renderSessionApp({
      auth: new FakeAuthService({ initialUser: authUser() }),
      backend,
      url: `/discover/${card.id}`,
    });

    expect(await screen.findByRole('header', { name: 'Piso en Chamberí' })).toBeTruthy();

    expect(backend.requestsTo('GET', `/homes/${card.id}`)).toHaveLength(1);
    expect(screen.queryByText(/Calle Secreta/)).toBeNull();
    expect(screen.queryByLabelText(/Calle Secreta/)).toBeNull();
    expect(
      screen.getByLabelText(
        new RegExp(d.detail.location.areaLabel.replace('{{area}}', 'Chamberí')),
      ),
    ).toBeTruthy();
  });

  it('una vivienda que ya no está disponible lo dice y deja volver', async () => {
    await open({ url: '/discover/no-existe' });

    expect(await screen.findByText(d.detail.gone)).toBeTruthy();
    await fireEvent.press(button(d.detail.back));

    expect(await screen.findByRole('button', { name: es.tabs.explore })).toBeTruthy();
  });

  it('volver desde el detalle conserva la tarjeta que se estaba viendo', async () => {
    await open({ cards: zoneCards(3) });
    await cardWith('Zona 1');
    await fireEvent.press(button(d.actions.dismiss));
    await fireEvent.press(await cardWith('Zona 2'));
    await screen.findByRole('header', { name: 'Piso en Zona 2' });

    await fireEvent.press(button(d.detail.back));

    expect(await cardWith('Zona 2')).toBeTruthy();
  });
});

describe('Elegir la vivienda desde la que se busca', () => {
  const malasana = published({ location: withArea('Malasaña').location! });
  const chamberi = published({ location: withArea('Chamberí').location! });

  async function openWithTwo() {
    const backend = await open({ homes: [malasana, chamberi], cards: zoneCards(2) });
    backend.discovery.byHome.set(malasana.id, [
      discoveryCard({
        ...withArea('Zona A'),
        compensation: { kind: 'pay', amountCents: 1_200_000 },
      }),
    ]);
    backend.discovery.byHome.set(chamberi.id, [
      discoveryCard({
        ...withArea('Zona B'),
        compensation: { kind: 'receive', amountCents: 400_000 },
      }),
    ]);
    return backend;
  }

  it('Scenario: Elegir la vivienda desde la que se busca - al cambiarla las tarjetas y su compensación se recalculan', async () => {
    const backend = await openWithTwo();
    const selector = await screen.findByLabelText(d.homeSelector.label);
    expect(
      within(selector).getByRole('radio', { name: 'Piso en Malasaña' }).props.accessibilityState,
    ).toMatchObject({ checked: true });
    expect(await cardWith('Zona A')).toBeTruthy();
    expect(screen.getByText(`Tú pagas ${formatEuros(1_200_000)}`)).toBeTruthy();

    await fireEvent.press(within(selector).getByRole('radio', { name: 'Piso en Chamberí' }));

    expect(await cardWith('Zona B')).toBeTruthy();
    expect(screen.getByText(`Tú recibes ${formatEuros(400_000)}`)).toBeTruthy();
    expect(discoverRequests(backend).map((request) => request.search)).toEqual([
      `?homeId=${malasana.id}`,
      `?homeId=${chamberi.id}`,
    ]);
  });

  it('con una sola vivienda publicada no hay selector', async () => {
    await open({ homes: [malasana, published({ status: 'paused' })], cards: zoneCards(1) });
    await cardWith('Zona 1');

    expect(screen.queryByLabelText(d.homeSelector.label)).toBeNull();
  });

  it('las viviendas con el mismo título se distinguen en el selector', async () => {
    await open({ homes: [published(), published()], cards: zoneCards(1) });
    const selector = await screen.findByLabelText(d.homeSelector.label);

    const labels = within(selector)
      .getAllByRole('radio')
      .map((radio) => radio.props.accessibilityLabel as string);

    expect(new Set(labels).size).toBe(2);
  });

  it('si la API pide la vivienda (400 HOME_ID_REQUIRED) lo explica y vuelve a buscar al elegirla', async () => {
    const backend = await open({ homes: [malasana, chamberi], cards: zoneCards(2) });
    backend.discovery.rejectNext(400, { code: 'HOME_ID_REQUIRED' });

    expect(await screen.findByText(d.homeSelector.required)).toBeTruthy();
    await fireEvent.press(
      within(screen.getByLabelText(d.homeSelector.label)).getByRole('radio', {
        name: 'Piso en Chamberí',
      }),
    );

    expect(await cardWith('Zona 1')).toBeTruthy();
    expect(discoverRequests(backend).at(-1)?.search).toBe(`?homeId=${chamberi.id}`);
  });

  it('si la vivienda elegida ya no está publicada (404) lo dice y reintenta con las que quedan', async () => {
    const backend = await open({ homes: [malasana, chamberi], cards: zoneCards(1) });
    backend.discovery.rejectNext(404);

    expect(await screen.findByText(d.errors.homeGone)).toBeTruthy();
    await fireEvent.press(button(d.errors.retry));

    expect(await cardWith('Zona 1')).toBeTruthy();
  });
});

describe('Sin más viviendas', () => {
  it('Scenario: Sin más viviendas - sugiere ampliar la zona o la compensación con acceso a los filtros', async () => {
    await open({ cards: [] });

    expect(await screen.findByRole('header', { name: d.end.title })).toBeTruthy();
    expect(screen.getByText(d.end.description)).toBeTruthy();

    await fireEvent.press(button(d.end.adjustCompensation));

    expect(await screen.findByRole('header', { name: s.sheet.title })).toBeTruthy();
    expect(screen.getByLabelText(s.form.maxToPay)).toBeTruthy();
    expect(screen.getAllByLabelText(s.bar.label)).toHaveLength(1);
  });

  it('«Ampliar zona» abre la hoja con la zona para poder ampliarla', async () => {
    await open({ cards: [] });
    await screen.findByRole('header', { name: d.end.title });

    await fireEvent.press(button(d.end.widenZone));

    expect(await screen.findByRole('header', { name: s.sheet.title })).toBeTruthy();
    expect(screen.getAllByLabelText(s.bar.label)).toHaveLength(2);
  });

  it('al pasar la última tarjeta aparece el estado vacío', async () => {
    await open({ cards: zoneCards(2) });
    await cardWith('Zona 1');
    await fireEvent.press(button(d.actions.dismiss));
    await cardWith('Zona 2');

    await fireEvent.press(button(d.actions.dismiss));

    expect(await screen.findByRole('header', { name: d.end.title })).toBeTruthy();
    expect(button(d.actions.dismiss).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('tras ajustar la compensación vuelve a buscar con lo guardado', async () => {
    const backend = await open({ cards: [] });
    await screen.findByRole('header', { name: d.end.title });
    await fireEvent.press(button(d.end.adjustCompensation));
    await screen.findByRole('header', { name: s.sheet.title });
    backend.discovery.cards = zoneCards(1);

    await fireEvent.changeText(screen.getByLabelText(s.form.maxToPay), '80.000');
    await fireEvent.press(button(s.sheet.save));

    expect(await cardWith('Zona 1')).toBeTruthy();
    expect(backend.searchPreferences.mine?.maxToPayCents).toBe(8_000_000);
  });
});

describe('Paginación', () => {
  it('Scenario: Paginación - pide la siguiente página al quedar 3 tarjetas y no repite ninguna', async () => {
    const cards = zoneCards(8);
    const backend = await open({ cards, pageSize: 5 });
    const homeId = backend.homes.all()[0]?.id ?? '';
    const seen: string[] = [];

    for (let position = 1; position <= 8; position += 1) {
      const card = await cardWith(`Zona ${String(position)}`);
      seen.push((card.props.accessibilityLabel as string).split('.')[0] ?? '');
      // Con las 5 cargadas, quedan 3 (la que se ve y dos más) en la tercera posición
      if (position < 3) expect(discoverRequests(backend)).toHaveLength(1);
      if (position === 3) {
        await waitFor(() => {
          expect(discoverRequests(backend)).toHaveLength(2);
        });
      }
      if (position < 8) await fireEvent.press(button(d.actions.dismiss));
    }

    expect(new Set(seen).size).toBe(8);
    expect(discoverRequests(backend).map((request) => request.search)).toEqual([
      `?homeId=${homeId}`,
      `?homeId=${homeId}&cursor=5`,
    ]);
    await fireEvent.press(button(d.actions.dismiss));
    expect(await screen.findByRole('header', { name: d.end.title })).toBeTruthy();
    expect(discoverRequests(backend)).toHaveLength(2);
  });

  it('no pide más páginas si la primera ya era la última', async () => {
    const backend = await open({ cards: zoneCards(2), pageSize: 5 });
    await cardWith('Zona 1');
    await fireEvent.press(button(d.actions.dismiss));
    await cardWith('Zona 2');

    expect(discoverRequests(backend)).toHaveLength(1);
  });

  it('una tarjeta que llega en dos páginas se muestra una sola vez', async () => {
    const cards = zoneCards(7);
    const repeated = [...cards.slice(0, 5), cards[0] as Card, ...cards.slice(5)];
    await open({ cards: repeated, pageSize: 5 });
    const areas: string[] = [];

    for (let position = 1; position <= 7; position += 1) {
      const card = await cardWith(`Zona ${String(position)}`);
      areas.push((card.props.accessibilityLabel as string).split('.')[0] ?? '');
      await fireEvent.press(button(d.actions.dismiss));
    }

    expect(new Set(areas).size).toBe(7);
    expect(await screen.findByRole('header', { name: d.end.title })).toBeTruthy();
  });

  it('si falla la página siguiente al llegar al final lo dice y deja reintentar', async () => {
    const backend = new FakeBackend({
      registered: true,
      profile: OWNER,
      homes: [published()],
      discoveryCards: zoneCards(6),
    });
    backend.discovery.pageSize = 3;
    backend.discovery.rejectNextPage(500);
    await renderSessionApp({ auth: new FakeAuthService({ initialUser: authUser() }), backend });
    await cardWith('Zona 1');
    await fireEvent.press(button(d.actions.dismiss));
    await cardWith('Zona 2');
    await fireEvent.press(button(d.actions.dismiss));
    await cardWith('Zona 3');
    await fireEvent.press(button(d.actions.dismiss));

    expect(await screen.findByText(d.errors.more)).toBeTruthy();
    await fireEvent.press(button(d.errors.retry));

    expect(await cardWith('Zona 4')).toBeTruthy();
  });
});

describe('Errores', () => {
  it('Scenario: Sin preferencias - el 422 lleva al paso de zona y compensación y, al guardarlas, a las tarjetas', async () => {
    const backend = await open({ cards: zoneCards(1) });
    await cardWith('Zona 1');
    backend.discovery.rejectNext(422, { code: 'SEARCH_PREFERENCES_REQUIRED' });
    await fireEvent.press(button(s.chips.garage));

    expect(
      await screen.findByRole('header', { name: s.firstUse.title }, SAVE_TIMEOUT),
    ).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(s.bar.label), 'getaf');
    await fireEvent.press(await screen.findByRole('button', { name: 'Getafe' }));
    await fireEvent.changeText(screen.getByLabelText(s.form.maxToPay), '30.000');
    await fireEvent.changeText(screen.getByLabelText(s.form.minToReceive), '0');
    await fireEvent.press(button(s.firstUse.action));

    expect(await cardWith('Zona 1')).toBeTruthy();
    expect(screen.queryByRole('header', { name: s.firstUse.title })).toBeNull();
  });

  it('un fallo de red se explica con una acción y reintentar carga las tarjetas', async () => {
    const backend = new FakeBackend({
      registered: true,
      profile: OWNER,
      homes: [published()],
      discoveryCards: zoneCards(1),
    });
    backend.discovery.rejectNext(500);
    await renderSessionApp({ auth: new FakeAuthService({ initialUser: authUser() }), backend });

    expect(await screen.findByText(d.errors.load)).toBeTruthy();
    await fireEvent.press(button(d.errors.retry));

    expect(await cardWith('Zona 1')).toBeTruthy();
    expect(screen.queryByText(d.errors.load)).toBeNull();
  });

  it('si no se pueden leer las viviendas propias lo explica y deja reintentar', async () => {
    const backend = new FakeBackend({
      registered: true,
      profile: OWNER,
      homes: [published()],
      discoveryCards: zoneCards(1),
    });
    backend.homes.rejectNextList(500);
    await renderSessionApp({ auth: new FakeAuthService({ initialUser: authUser() }), backend });

    expect(await screen.findByText(d.errors.load)).toBeTruthy();
    expect(discoverRequests(backend)).toHaveLength(0);
    await fireEvent.press(button(d.errors.retry));

    expect(await cardWith('Zona 1')).toBeTruthy();
  });
});

describe('Preferencias de una vivienda', () => {
  it('cambiar las preferencias propias de una vivienda actualiza las tarjetas al volver a «Explorar»', async () => {
    const home = published();
    const backend = await open({ homes: [home], cards: zoneCards(1) });
    await cardWith('Zona 1');
    await fireEvent.press(await screen.findByRole('button', { name: es.tabs.homes }));
    await fireEvent.press(
      await screen.findByRole('link', {
        name: es.homes.card.open.replace('{{title}}', 'Piso en Malasaña'),
      }),
    );
    await screen.findByRole('header', { name: s.home.title });

    await fireEvent.press(button(s.home.define));
    await screen.findByRole('header', { name: s.home.sheetTitle });
    await fireEvent.press(button(s.sheet.save));

    await waitFor(() => {
      expect(discoverRequests(backend).length).toBeGreaterThanOrEqual(2);
    }, SAVE_TIMEOUT);
  });
});
