import { themes } from '@changehouse/ui';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { formatEuros } from '../features/homes/home-form';
import type { Home } from '../features/homes/homes-api';
import type { SearchPreferences } from '../features/search/search-preferences-api';
import es from '../i18n/locales/es-ES.json';
import { authUser, FakeAuthService } from '../test-support/fake-auth-service';
import { FakeBackend } from '../test-support/fake-backend';
import { completeHome } from '../test-support/fake-homes';
import { renderSessionApp } from '../test-support/render-session-app';
import { styleOf, THEME_NAMES } from '../test-utils';

// Flujos completos de la app (rutas, formularios y API simulada): el primero carga todos los módulos
jest.setTimeout(30_000);

const s = es.search;
const SAVE_TIMEOUT = { timeout: 4000 };

const button = (name: string) => screen.getByRole('button', { name });
const field = (label: string) => screen.getByLabelText(label);
const PUT_MINE = ['PUT', '/me/search-preferences'] as const;

const GETAFE: SearchPreferences = {
  municipalities: ['Getafe'],
  filters: {},
  maxToPayCents: 3_000_000,
  minToReceiveCents: 0,
  valueReferencePct: 50,
};

interface OpenOptions {
  preferences?: SearchPreferences | null;
  homes?: readonly Home[];
  theme?: 'light' | 'dark';
}

/** Una persona dada de alta que abre «Explorar». */
async function openExplore({ preferences = GETAFE, homes = [], theme }: OpenOptions = {}) {
  const backend = new FakeBackend({ registered: true, homes, searchPreferences: preferences });
  const auth = new FakeAuthService({ initialUser: authUser() });
  await renderSessionApp({ auth, backend, ...(theme ? { theme } : {}) });
  return backend;
}

async function pickZone(query: string, suggestion: string) {
  await fireEvent.changeText(field(s.bar.label), query);
  await fireEvent.press(await screen.findByRole('button', { name: suggestion }));
}

async function openSheet() {
  await fireEvent.press(button(s.chips.more));
  return screen.findByRole('header', { name: s.sheet.title });
}

const savedPutCount = (backend: FakeBackend) => backend.requestsTo(...PUT_MINE).length;

describe('Primer uso', () => {
  it('Scenario: Primer uso - sin preferencias ve el paso de zona y compensación antes de cualquier tarjeta', async () => {
    await openExplore({ preferences: null });

    expect(await screen.findByRole('header', { name: s.firstUse.title })).toBeTruthy();
    expect(screen.queryByText(es.discovery.end.title)).toBeNull();
    expect(screen.queryByRole('button', { name: s.chips.garage })).toBeNull();
  });

  it('Scenario: Guardar preferencias - Getafe, 30.000 € a pagar y 0 € a recibir quedan guardados con el punto de referencia 50', async () => {
    const backend = await openExplore({ preferences: null });
    await screen.findByRole('header', { name: s.firstUse.title });

    await pickZone('getaf', 'Getafe');
    await fireEvent.changeText(field(s.form.maxToPay), '30.000');
    await fireEvent.changeText(field(s.form.minToReceive), '0');
    await fireEvent.press(button(s.firstUse.action));

    expect(await screen.findByText(es.discovery.end.title)).toBeTruthy();
    expect(backend.requestsTo(...PUT_MINE)[0]?.body).toEqual({
      municipalities: ['Getafe'],
      filters: {},
      maxToPayCents: 3_000_000,
      minToReceiveCents: 0,
      valueReferencePct: 50,
    });

    await fireEvent.press(button(s.chips.bedrooms));
    await fireEvent.press(button(s.chips.bedroomsMin.replace('{{count}}', '1')));
    await fireEvent.press(button(s.chips.bedroomsMin.replace('{{count}}', '2')));
    await waitFor(() => {
      expect(backend.searchPreferences.mine).toMatchObject({
        municipalities: ['Getafe'],
        filters: { minBedrooms: 3 },
        maxToPayCents: 3_000_000,
        minToReceiveCents: 0,
        valueReferencePct: 50,
      });
    }, SAVE_TIMEOUT);
  });

  it('Scenario: Sin zona - pide elegir una zona junto al campo y no llama a la API', async () => {
    const backend = await openExplore({ preferences: null });
    await screen.findByRole('header', { name: s.firstUse.title });

    await fireEvent.changeText(field(s.form.maxToPay), '30.000');
    await fireEvent.changeText(field(s.form.minToReceive), '0');
    await fireEvent.press(button(s.firstUse.action));

    expect(await screen.findByText(s.zone.required)).toBeTruthy();
    expect(savedPutCount(backend)).toBe(0);
  });

  it('señala los importes que faltan', async () => {
    const backend = await openExplore({ preferences: null });
    await screen.findByRole('header', { name: s.firstUse.title });
    await pickZone('getaf', 'Getafe');

    await fireEvent.press(button(s.firstUse.action));

    expect(await screen.findByText(s.errors.maxToPay)).toBeTruthy();
    expect(screen.getByText(s.errors.minToReceive)).toBeTruthy();
    expect(savedPutCount(backend)).toBe(0);
  });

  it('Scenario: Sin zona - si la API responde 422 la app pide elegir una zona', async () => {
    const backend = await openExplore({ preferences: null });
    await screen.findByRole('header', { name: s.firstUse.title });
    await pickZone('getaf', 'Getafe');
    await fireEvent.changeText(field(s.form.maxToPay), '30.000');
    await fireEvent.changeText(field(s.form.minToReceive), '0');
    backend.searchPreferences.rejectNextPut(422, {
      code: 'SEARCH_PREFERENCES_INCOMPLETE',
      errors: [{ field: 'municipalities', message: 'required' }],
    });

    await fireEvent.press(button(s.firstUse.action));

    expect(await screen.findByText(s.zone.required)).toBeTruthy();
  });

  it('un fallo de red al guardar se explica y deja reintentar', async () => {
    const backend = await openExplore({ preferences: null });
    await screen.findByRole('header', { name: s.firstUse.title });
    await pickZone('getaf', 'Getafe');
    await fireEvent.changeText(field(s.form.maxToPay), '30.000');
    await fireEvent.changeText(field(s.form.minToReceive), '0');
    backend.searchPreferences.rejectNextPut(500);

    await fireEvent.press(button(s.firstUse.action));
    expect(await screen.findByText(s.sheet.saveFailed)).toBeTruthy();

    await fireEvent.press(button(s.firstUse.action));
    expect(await screen.findByText(es.discovery.end.title)).toBeTruthy();
  });

  it('si no se pueden cargar las preferencias lo explica y permite reintentar', async () => {
    const backend = new FakeBackend({ registered: true });
    backend.searchPreferences.rejectNextGet(500);
    await renderSessionApp({
      auth: new FakeAuthService({ initialUser: authUser() }),
      backend,
    });

    expect(await screen.findByText(s.loadFailed)).toBeTruthy();
    await fireEvent.press(button(s.retry));

    expect(await screen.findByText(es.discovery.end.title)).toBeTruthy();
  });
});

describe('Barra de búsqueda', () => {
  it('Scenario: Escribir un sitio - «Alcob» y «Alcobendas» queda como zona y se guarda', async () => {
    const backend = await openExplore();
    await screen.findByText(es.discovery.end.title);

    await pickZone('Alcob', 'Alcobendas');

    expect(button(s.zone.remove.replace('{{name}}', 'Alcobendas'))).toBeTruthy();
    await waitFor(() => {
      expect(backend.searchPreferences.mine?.municipalities).toEqual(['Getafe', 'Alcobendas']);
    }, SAVE_TIMEOUT);
  });

  it('elegir un barrio fija un punto con radio de 5 km', async () => {
    const backend = await openExplore();
    await screen.findByText(es.discovery.end.title);

    await pickZone('malasa', 'Malasaña');

    await waitFor(() => {
      expect(backend.searchPreferences.mine).toMatchObject({
        center: { lat: 40.4265, lng: -3.7038 },
        radiusKm: 5,
        municipalities: ['Getafe'],
      });
    }, SAVE_TIMEOUT);
    expect(
      screen.getByText(s.zone.around.replace('{{name}}', 'Malasaña').replace('{{km}}', '5')),
    ).toBeTruthy();
  });

  it('quitar una zona la elimina y se guarda', async () => {
    const backend = await openExplore({
      preferences: { ...GETAFE, municipalities: ['Getafe', 'Madrid'] },
    });
    await screen.findByText(es.discovery.end.title);

    await fireEvent.press(button(s.zone.remove.replace('{{name}}', 'Getafe')));

    await waitFor(() => {
      expect(backend.searchPreferences.mine?.municipalities).toEqual(['Madrid']);
    }, SAVE_TIMEOUT);
  });

  it('quitar la última zona pide elegir otra y no llama a la API', async () => {
    const backend = await openExplore();
    await screen.findByText(es.discovery.end.title);

    await fireEvent.press(button(s.zone.remove.replace('{{name}}', 'Getafe')));

    expect(await screen.findByText(s.zone.required)).toBeTruthy();
    expect(savedPutCount(backend)).toBe(0);
  });

  it('sin coincidencias lo explica', async () => {
    await openExplore();
    await screen.findByText(es.discovery.end.title);

    await fireEvent.changeText(field(s.bar.label), 'zzzz');

    expect(await screen.findByText(s.bar.noResults)).toBeTruthy();
  });

  it('si falla el servicio de sitios lo explica', async () => {
    const backend = new FakeBackend({ registered: true });
    await renderSessionApp({
      auth: new FakeAuthService({ initialUser: authUser() }),
      backend,
      zoneSuggestions: { suggest: () => Promise.reject(new Error('sin red')) },
    });
    await screen.findByText(es.discovery.end.title);

    await fireEvent.changeText(field(s.bar.label), 'getaf');

    expect(await screen.findByText(s.bar.failed)).toBeTruthy();
  });

  it('sin viviendas compatibles, la búsqueda guardada se ve en la barra y el estado vacío ofrece ampliarla', async () => {
    await openExplore();

    expect(await screen.findByText(es.discovery.end.title)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: s.zone.remove.replace('{{name}}', 'Getafe') }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: es.discovery.end.widenZone })).toBeTruthy();
  });
});

describe('Chips de un toque', () => {
  it('Scenario: Activar un chip - «Garaje» queda activado, se anuncia y se guarda el filtro', async () => {
    const backend = await openExplore();
    await screen.findByText(es.discovery.end.title);
    expect(button(s.chips.garage).props.accessibilityState).toMatchObject({ selected: false });

    await fireEvent.press(button(s.chips.garage));

    expect(button(s.chips.garage).props.accessibilityState).toMatchObject({ selected: true });
    expect(await screen.findByText(s.status.saving)).toBeTruthy();
    await waitFor(() => {
      expect(backend.searchPreferences.mine?.filters).toEqual({ garage: true });
    }, SAVE_TIMEOUT);
    expect(await screen.findByText(s.status.saved)).toBeTruthy();
  });

  it('varios toques seguidos se juntan en una sola petición con el último estado', async () => {
    const backend = await openExplore();
    await screen.findByText(es.discovery.end.title);

    await fireEvent.press(button(s.chips.garage));
    await fireEvent.press(button(s.chips.lift));
    await fireEvent.press(button(s.chips.exterior));
    await fireEvent.press(button(s.chips.exterior));

    await waitFor(() => {
      expect(backend.searchPreferences.mine?.filters).toEqual({ garage: true, lift: true });
    }, SAVE_TIMEOUT);
    expect(savedPutCount(backend)).toBe(1);
  });

  it('el chip de dormitorios recorre los mínimos y se anuncia con su valor', async () => {
    await openExplore();
    await screen.findByText(es.discovery.end.title);

    await fireEvent.press(button(s.chips.bedrooms));
    await fireEvent.press(button(s.chips.bedroomsMin.replace('{{count}}', '1')));

    const chip = button(s.chips.bedroomsMin.replace('{{count}}', '2'));
    expect(chip.props.accessibilityState).toMatchObject({ selected: true });
  });

  it('el chip «Tipo» despliega los tipos y elegir uno lo guarda', async () => {
    const backend = await openExplore();
    await screen.findByText(es.discovery.end.title);

    await fireEvent.press(button(s.chips.type));
    expect(button(s.chips.type).props.accessibilityState).toMatchObject({ expanded: true });
    await fireEvent.press(screen.getByRole('checkbox', { name: es.homes.type.casa }));

    await waitFor(() => {
      expect(backend.searchPreferences.mine?.filters).toEqual({ types: ['casa'] });
    }, SAVE_TIMEOUT);
    expect(button(s.chips.type).props.accessibilityState).toMatchObject({ selected: true });
  });

  it('si la API falla deshace el cambio y avisa', async () => {
    const backend = await openExplore();
    await screen.findByText(es.discovery.end.title);
    backend.searchPreferences.rejectNextPut(500);

    await fireEvent.press(button(s.chips.garage));

    expect(await screen.findByText(s.status.failed, undefined, SAVE_TIMEOUT)).toBeTruthy();
    expect(button(s.chips.garage).props.accessibilityState).toMatchObject({ selected: false });
    expect(backend.searchPreferences.mine?.filters).toEqual({});
  });

  it.each(THEME_NAMES)('en el tema %s el chip activado usa el color primario', async (theme) => {
    await openExplore({ theme });
    await screen.findByText(es.discovery.end.title);

    await fireEvent.press(button(s.chips.garage));

    expect(styleOf(button(s.chips.garage)).backgroundColor).toBe(themes[theme].color.primary);
    expect(styleOf(button(s.chips.garage))).toMatchObject({ minHeight: 44 });
  });
});

describe('Filtros y compensación', () => {
  it('la hoja muestra la compensación en euros con formato y guarda en céntimos', async () => {
    const backend = await openExplore();
    await screen.findByText(es.discovery.end.title);
    await openSheet();

    expect(field(s.form.maxToPay).props.value).toBe('30.000');
    await fireEvent.changeText(field(s.form.maxToPay), '25.000');
    expect(
      screen.getByText(s.form.amountPreview.replace('{{amount}}', formatEuros(2_500_000))),
    ).toBeTruthy();
    await fireEvent.changeText(field(s.form.minToReceive), '1.500,50');
    await fireEvent.changeText(field(s.form.minUsefulM2), '80,5');
    await fireEvent.press(screen.getByRole('checkbox', { name: s.form.lift }));
    await fireEvent.press(
      within(screen.getByLabelText(s.form.minBedrooms)).getByRole('radio', { name: '3' }),
    );
    await fireEvent.press(button(s.sheet.save));

    await waitFor(() => {
      expect(screen.queryByRole('header', { name: s.sheet.title })).toBeNull();
    }, SAVE_TIMEOUT);
    expect(backend.searchPreferences.mine).toMatchObject({
      maxToPayCents: 2_500_000,
      minToReceiveCents: 150_050,
      filters: { lift: true, minBedrooms: 3, minUsefulM2: 80.5 },
    });
  });

  it('el punto del rango de valor se ajusta, se explica en una línea y se guarda', async () => {
    const backend = await openExplore();
    await screen.findByText(es.discovery.end.title);
    await openSheet();

    expect(screen.getByText(s.valueReference.explanation)).toBeTruthy();
    expect(screen.getByText('50 %')).toBeTruthy();
    await fireEvent.press(button(s.valueReference.higher));
    await fireEvent.press(button(s.valueReference.higher));
    expect(screen.getByText('70 %')).toBeTruthy();
    await fireEvent.press(button(s.sheet.save));

    await waitFor(() => {
      expect(backend.searchPreferences.mine?.valueReferencePct).toBe(70);
    }, SAVE_TIMEOUT);
  });

  it('el punto del rango no sale de 0 a 100', async () => {
    await openExplore({ preferences: { ...GETAFE, valueReferencePct: 100 } });
    await screen.findByText(es.discovery.end.title);
    await openSheet();

    expect(button(s.valueReference.higher).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await fireEvent.press(button(s.valueReference.lower));
    expect(screen.getByText('90 %')).toBeTruthy();
  });

  it('importes no válidos se señalan junto a su campo y no se envía nada', async () => {
    const backend = await openExplore();
    await screen.findByText(es.discovery.end.title);
    await openSheet();

    await fireEvent.changeText(field(s.form.maxToPay), 'muchos');
    await fireEvent.changeText(field(s.form.minToReceive), '');
    await fireEvent.press(button(s.sheet.save));

    expect(await screen.findByText(s.errors.maxToPay)).toBeTruthy();
    expect(screen.getByText(s.errors.minToReceive)).toBeTruthy();
    expect(savedPutCount(backend)).toBe(0);
  });

  it('Scenario: Punto de referencia fuera de rango - el 400 de la API se muestra junto al punto del rango', async () => {
    const backend = await openExplore();
    await screen.findByText(es.discovery.end.title);
    await openSheet();
    backend.searchPreferences.rejectNextPut(400, {
      errors: [{ field: 'valueReferencePct', message: 'invalid' }],
    });

    await fireEvent.press(button(s.sheet.save));

    expect(await screen.findByText(s.errors.valueReferencePct)).toBeTruthy();
    expect(screen.getByRole('header', { name: s.sheet.title })).toBeTruthy();
  });

  it('el radio de un punto se ajusta en la hoja', async () => {
    const backend = await openExplore({
      preferences: { ...GETAFE, municipalities: [], center: { lat: 40.4, lng: -3.7 }, radiusKm: 5 },
    });
    await screen.findByText(es.discovery.end.title);
    await openSheet();

    await fireEvent.press(
      screen.getByRole('radio', { name: s.zone.radiusOption.replace('{{km}}', '25') }),
    );
    await fireEvent.press(button(s.sheet.save));

    await waitFor(() => {
      expect(backend.searchPreferences.mine?.radiusKm).toBe(25);
    }, SAVE_TIMEOUT);
  });

  it('un fallo de red en la hoja la deja abierta con un mensaje', async () => {
    const backend = await openExplore();
    await screen.findByText(es.discovery.end.title);
    await openSheet();
    backend.searchPreferences.rejectNextPut(500);

    await fireEvent.press(button(s.sheet.save));

    expect(await screen.findByText(s.sheet.saveFailed)).toBeTruthy();
    await fireEvent.press(button(s.sheet.close));
    await waitFor(() => {
      expect(screen.queryByRole('header', { name: s.sheet.title })).toBeNull();
    });
  });
});

describe('Preferencias de una vivienda', () => {
  const home = completeHome({ status: 'published' });

  async function openHomeDetail(options: OpenOptions = {}) {
    const backend = await openExplore({ homes: [home], ...options });
    await fireEvent.press(await screen.findByRole('button', { name: es.tabs.homes }));
    await fireEvent.press(
      await screen.findByRole('link', {
        name: es.homes.card.open.replace('{{title}}', 'Piso en Malasaña'),
      }),
    );
    await screen.findByRole('header', { name: s.home.title });
    return backend;
  }

  it('una vivienda sin preferencias propias usa las del usuario', async () => {
    await openHomeDetail();

    expect(screen.getByText(s.home.inherited)).toBeTruthy();
    expect(screen.getByText(/Getafe/)).toBeTruthy();
  });

  it('Scenario: Preferencias distintas para una segunda vivienda - define Valencia solo para ella', async () => {
    const backend = await openHomeDetail();

    await fireEvent.press(button(s.home.define));
    await screen.findByRole('header', { name: s.home.sheetTitle });
    await fireEvent.press(button(s.zone.remove.replace('{{name}}', 'Getafe')));
    await pickZone('valen', 'Valencia');
    await fireEvent.press(button(s.sheet.save));

    await waitFor(() => {
      expect(backend.searchPreferences.byHome.get(home.id)?.municipalities).toEqual(['Valencia']);
    }, SAVE_TIMEOUT);
    expect(backend.searchPreferences.mine?.municipalities).toEqual(['Getafe']);
    expect(await screen.findByText(s.home.own)).toBeTruthy();
    expect(screen.getByText(/Valencia/)).toBeTruthy();
  });

  it('puede editar las propias', async () => {
    const backend = new FakeBackend({ registered: true, homes: [home], searchPreferences: GETAFE });
    backend.searchPreferences.byHome.set(home.id, { ...GETAFE, municipalities: ['Valencia'] });
    await renderSessionApp({ auth: new FakeAuthService({ initialUser: authUser() }), backend });
    await fireEvent.press(await screen.findByRole('button', { name: es.tabs.homes }));
    await openHomeDetailAgain();

    await fireEvent.press(button(s.home.edit));
    await screen.findByRole('header', { name: s.home.sheetTitle });
    await fireEvent.changeText(field(s.form.maxToPay), '10.000');
    await fireEvent.press(button(s.sheet.save));

    await waitFor(() => {
      expect(backend.searchPreferences.byHome.get(home.id)?.maxToPayCents).toBe(1_000_000);
    }, SAVE_TIMEOUT);
  });

  async function openHomeDetailAgain() {
    await fireEvent.press(
      await screen.findByRole('link', {
        name: es.homes.card.open.replace('{{title}}', 'Piso en Malasaña'),
      }),
    );
    await screen.findByRole('header', { name: s.home.title });
  }

  it('Scenario: Volver a las del usuario - «Usar las mías» las elimina tras confirmar y muestra las del usuario', async () => {
    const backend = new FakeBackend({
      registered: true,
      homes: [home],
      searchPreferences: GETAFE,
    });
    backend.searchPreferences.byHome.set(home.id, { ...GETAFE, municipalities: ['Valencia'] });
    await renderSessionApp({ auth: new FakeAuthService({ initialUser: authUser() }), backend });
    await fireEvent.press(await screen.findByRole('button', { name: es.tabs.homes }));
    await openHomeDetailAgain();
    expect(await screen.findByText(s.home.own)).toBeTruthy();

    await fireEvent.press(button(s.home.useMine));
    const dialog = await screen.findByLabelText(s.home.confirmTitle);
    expect(backend.searchPreferences.byHome.has(home.id)).toBe(true);
    await fireEvent.press(within(dialog).getByRole('button', { name: s.home.confirmAction }));

    expect(await screen.findByText(s.home.inherited)).toBeTruthy();
    expect(backend.searchPreferences.byHome.has(home.id)).toBe(false);
    expect(screen.getByText(/Getafe/)).toBeTruthy();
  });

  it('cancelar la confirmación no elimina nada', async () => {
    const backend = new FakeBackend({ registered: true, homes: [home] });
    backend.searchPreferences.byHome.set(home.id, { ...GETAFE, municipalities: ['Valencia'] });
    await renderSessionApp({ auth: new FakeAuthService({ initialUser: authUser() }), backend });
    await fireEvent.press(await screen.findByRole('button', { name: es.tabs.homes }));
    await openHomeDetailAgain();

    await fireEvent.press(button(s.home.useMine));
    await fireEvent.press(await screen.findByRole('button', { name: s.home.cancel }));

    expect(backend.searchPreferences.byHome.has(home.id)).toBe(true);
    await waitFor(() => {
      expect(screen.queryByLabelText(s.home.confirmTitle)).toBeNull();
    });
  });

  it('si falla el borrado lo explica y conserva las propias', async () => {
    const backend = new FakeBackend({ registered: true, homes: [home] });
    backend.searchPreferences.byHome.set(home.id, { ...GETAFE, municipalities: ['Valencia'] });
    await renderSessionApp({ auth: new FakeAuthService({ initialUser: authUser() }), backend });
    await fireEvent.press(await screen.findByRole('button', { name: es.tabs.homes }));
    await openHomeDetailAgain();
    await fireEvent.press(button(s.home.useMine));
    await screen.findByLabelText(s.home.confirmTitle);
    backend.failNext = 'server';

    await fireEvent.press(await screen.findByRole('button', { name: s.home.confirmAction }));

    expect(await screen.findByText(s.home.deleteFailed)).toBeTruthy();
    expect(backend.searchPreferences.byHome.has(home.id)).toBe(true);
  });
});
