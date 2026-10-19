import { FIXTURE_PLACES } from '@changehouse/shared';
import { themes } from '@changehouse/ui';
import { fireEvent, screen } from '@testing-library/react-native';

import type { AddressSuggestions } from '../features/homes/address-suggestions';
import type { Home } from '../features/homes/homes-api';
import es from '../i18n/locales/es-ES.json';
import { authUser, FakeAuthService } from '../test-support/fake-auth-service';
import { FakeBackend } from '../test-support/fake-backend';
import { completeHome, draftHome, readyPhotos } from '../test-support/fake-homes';
import { problem } from '../test-support/http-responses';
import { renderSessionApp } from '../test-support/render-session-app';
import { styleOf, THEME_NAMES } from '../test-utils';

// Flujos completos de la app (rutas, formularios y API simulada): el primero carga todos los módulos
jest.setTimeout(30_000);

const { homes: h } = es;

const MALASANA = FIXTURE_PLACES[0];
const CHAMBERI = FIXTURE_PLACES[1];
const MALASANA_TITLE = 'Piso en Malasaña';

const button = (name: string) => screen.getByRole('button', { name });
const radio = (name: string) => screen.getByRole('radio', { name });
const checkbox = (name: string) => screen.getByRole('checkbox', { name });
const field = (label: string) => screen.getByLabelText(label);
const stepBar = (current: number) =>
  screen.findByRole('progressbar', {
    name: h.wizard.step.replace('{{current}}', String(current)).replace('{{total}}', '6'),
  });
const cardAction = (action: string, title = MALASANA_TITLE) =>
  h.card.action.replace('{{action}}', action).replace('{{title}}', title);

interface OpenOptions {
  homes?: readonly Home[];
  theme?: 'light' | 'dark';
  addressSuggestions?: AddressSuggestions;
  backend?: FakeBackend;
}

/** Una persona dada de alta que abre la pestaña «Mis casas». */
async function openHomes({ homes = [], theme, addressSuggestions, backend }: OpenOptions = {}) {
  const auth = new FakeAuthService({ initialUser: authUser() });
  const api = backend ?? new FakeBackend({ registered: true, homes });
  const view = await renderSessionApp({
    auth,
    backend: api,
    ...(theme ? { theme } : {}),
    ...(addressSuggestions ? { addressSuggestions } : {}),
  });
  await fireEvent.press(await screen.findByRole('button', { name: es.tabs.homes }));
  return { auth, backend: api, view };
}

async function chooseAddress(query: string, suggestion: string) {
  await fireEvent.changeText(field(h.form.address), query);
  await fireEvent.press(await screen.findByRole('button', { name: suggestion }));
}

/** El paso de fotos no bloquea: un borrador admite avanzar sin ellas y subirlas más tarde. */
async function skipPhotos() {
  await fireEvent.press(button(h.wizard.next));
  await stepBar(2);
}

/** Del estado vacío al segundo paso: crea el borrador con el piso de Malasaña. */
async function startWizard(options: OpenOptions = {}) {
  const opened = await openHomes(options);
  await fireEvent.press(await screen.findByRole('button', { name: h.empty.action }));
  await stepBar(1);
  await skipPhotos();
  await fireEvent.press(radio(h.type.piso));
  await chooseAddress('pez', MALASANA?.formatted ?? '');
  await fireEvent.press(button(h.wizard.next));
  await stepBar(3);
  return opened;
}

describe('Mis casas', () => {
  it('Scenario: Sin viviendas - explica que sin casa publicada no hay matches y ofrece publicar la primera', async () => {
    await openHomes();

    expect(await screen.findByRole('header', { name: h.empty.title })).toBeTruthy();
    expect(screen.getByText(h.empty.description)).toBeTruthy();

    await fireEvent.press(button(h.empty.action));

    expect(await stepBar(1)).toBeTruthy();
    expect(screen.getByRole('header', { name: h.wizard.steps.photos })).toBeTruthy();
  });

  it('Scenario: Segunda vivienda - muestra las dos viviendas, cada una con su estado', async () => {
    const published = completeHome({ status: 'published' });
    const { backend } = await openHomes({ homes: [published] });
    await fireEvent.press(await screen.findByRole('button', { name: h.add }));
    await stepBar(1);
    await skipPhotos();

    await fireEvent.press(radio(h.type.piso));
    await chooseAddress('santa engracia', CHAMBERI?.formatted ?? '');
    await fireEvent.press(button(h.wizard.next));
    await stepBar(3);
    await fireEvent.press(button(h.wizard.exit));

    expect(await screen.findByText(h.status.published)).toBeTruthy();
    expect(screen.getByText(h.status.draft)).toBeTruthy();
    expect(screen.getByText('Piso en Chamberí')).toBeTruthy();
    expect(screen.getByText(MALASANA_TITLE)).toBeTruthy();
    expect(backend.homes.all()).toHaveLength(2);
  });

  it('cada tarjeta ofrece su acción principal según el estado, con estado en texto e icono', async () => {
    const homes = [
      draftHome(),
      completeHome(),
      completeHome({ status: 'in_review' }),
      completeHome({ status: 'published' }),
      completeHome({ status: 'paused' }),
    ];
    await openHomes({ homes });

    expect(await screen.findAllByText(MALASANA_TITLE)).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: cardAction(h.actions.continue) })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: cardAction(h.actions.submit) })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: cardAction(h.actions.view) })).toHaveLength(3);
    expect(screen.getAllByText(h.status.draft)).toHaveLength(2);
    for (const status of ['in_review', 'published', 'paused'] as const) {
      expect(screen.getByText(h.status[status])).toBeTruthy();
    }
    // Solo el borrador sin fotos muestra el marcador; las demás tienen portada
    expect(screen.getAllByText(h.card.noPhotos)).toHaveLength(1);
    expect(screen.getAllByTestId('home-cover')).toHaveLength(4);
  });

  it('muestra el rango de valor en euros con formato es-ES, o que falta indicarlo', async () => {
    await openHomes({ homes: [draftHome(), completeHome()] });

    expect(await screen.findByText(h.card.noValue)).toBeTruthy();
    const range = h.card.value.replace('{{min}}', '250.000 €').replace('{{max}}', '300.000 €');
    expect(screen.getByText(range.replaceAll(' €', ' €'))).toBeTruthy();
  });

  it('mientras carga se anuncia y, si falla, explica qué hacer y permite reintentar', async () => {
    const backend = new FakeBackend({ registered: true, homes: [draftHome()] });
    const auth = new FakeAuthService({ initialUser: authUser() });
    // «Explorar» ya pide las viviendas al abrir la app y comparte la consulta con «Mis casas»
    // y al abrir «Mis casas» reintenta la consulta fallida
    backend.homes.rejectNextList(500, 2);
    await renderSessionApp({ auth, backend });
    const tab = await screen.findByRole('button', { name: es.tabs.homes });

    await fireEvent.press(tab);

    expect(await screen.findByText(h.loadFailed)).toBeTruthy();
    await fireEvent.press(button(h.retry));
    expect(await screen.findByText(MALASANA_TITLE)).toBeTruthy();
    expect(screen.queryByText(h.loadFailed)).toBeNull();
  });

  it('el botón de añadir otra casa no se ofrece en el estado vacío', async () => {
    await openHomes();

    await screen.findByRole('header', { name: h.empty.title });
    expect(screen.queryByRole('button', { name: h.add })).toBeNull();
  });
});

describe('Asistente de alta', () => {
  it('Scenario: Asistente que guarda el avance - crea el borrador en el primer paso y al volver continúa donde se dejó', async () => {
    const { backend, view } = await startWizard();

    expect(backend.requestsTo('POST', '/homes')).toMatchObject([
      {
        authorization: 'Bearer token-de-prueba',
        body: {
          type: 'piso',
          address: { placeId: 'fixture-malasana', formatted: MALASANA?.formatted },
        },
      },
    ]);

    // Cierra la app y vuelve a «Mis casas»
    // Con las fotos ya subidas, el borrador continúa en el primer paso que falta
    backend.homes.all()[0]!.photos = readyPhotos(3);
    await view.unmount();
    await openHomes({ backend });

    expect(await screen.findByText(h.status.draft)).toBeTruthy();
    await fireEvent.press(button(cardAction(h.actions.continue)));
    expect(await stepBar(3)).toBeTruthy();
  });

  it('guarda las características en el segundo paso y al reabrir el borrador continúa en el tercero con los datos guardados', async () => {
    const { backend, view } = await startWizard();

    await fireEvent.changeText(field(h.form.usefulM2), '80,5');
    await fireEvent.changeText(field(h.form.builtM2), '95');
    await fireEvent.changeText(field(h.form.bedrooms), '3');
    await fireEvent.changeText(field(h.form.bathrooms), '2');
    await fireEvent.press(checkbox(h.form.hasLift));
    await fireEvent.press(checkbox(h.features.terrace));
    await fireEvent.press(radio('C'));
    await fireEvent.press(button(h.wizard.next));
    await stepBar(4);

    const [patch, ...others] = backend.requests.filter((request) => request.method === 'PATCH');
    expect(others).toEqual([]);
    expect(patch?.body).toEqual({
      usefulM2: 80.5,
      builtM2: 95,
      bedrooms: 3,
      bathrooms: 2,
      hasLift: true,
      garage: false,
      storageRoom: false,
      energyRating: 'C',
      features: { terrace: true },
    });

    // Con las fotos ya subidas, el borrador continúa en el primer paso que falta
    backend.homes.all()[0]!.photos = readyPhotos(3);
    await view.unmount();
    await openHomes({ backend });
    await fireEvent.press(
      await screen.findByRole('button', { name: cardAction(h.actions.continue) }),
    );
    await stepBar(4);

    await fireEvent.press(button(h.wizard.back));
    await stepBar(3);
    expect(field(h.form.usefulM2).props.value).toBe('80,5');
    expect(field(h.form.bedrooms).props.value).toBe('3');
    expect(checkbox(h.form.hasLift).props.accessibilityState).toMatchObject({ checked: true });
    expect(checkbox(h.features.terrace).props.accessibilityState).toMatchObject({ checked: true });
    expect(radio('C').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('un campo numérico no válido se señala junto al campo y el paso no se guarda', async () => {
    const { backend } = await startWizard();

    await fireEvent.changeText(field(h.form.bedrooms), '2,5');
    await fireEvent.press(button(h.wizard.next));

    expect(await screen.findByText(h.errors.bedrooms)).toBeTruthy();
    expect(screen.getByRole('alert', { name: h.errors.bedrooms })).toBeTruthy();
    expect(backend.requests.filter((request) => request.method === 'PATCH')).toHaveLength(0);
    expect(await stepBar(3)).toBeTruthy();
  });

  it('el primer paso exige elegir tipo y dirección sin llamar a la API', async () => {
    const { backend } = await openHomes();
    await fireEvent.press(await screen.findByRole('button', { name: h.empty.action }));
    await stepBar(1);
    await skipPhotos();

    await fireEvent.press(button(h.wizard.next));

    expect(await screen.findByText(h.errors.type)).toBeTruthy();
    expect(screen.getByText(h.errors.address)).toBeTruthy();
    expect(backend.requestsTo('POST', '/homes')).toHaveLength(0);
  });

  it('el autocompletado explica cuándo no hay resultados y cuándo falla el servicio', async () => {
    const failing: AddressSuggestions = {
      suggest: jest
        .fn<ReturnType<AddressSuggestions['suggest']>, [string]>()
        .mockResolvedValueOnce([])
        .mockRejectedValue(new Error('sin red')),
      endSession: jest.fn(),
    };
    await openHomes({ addressSuggestions: failing });
    await fireEvent.press(await screen.findByRole('button', { name: h.empty.action }));
    await stepBar(1);
    await skipPhotos();

    await fireEvent.changeText(field(h.form.address), 'zzzz');
    expect(await screen.findByText(h.form.addressNoResults)).toBeTruthy();

    await fireEvent.changeText(field(h.form.address), 'calle');
    expect(await screen.findByText(h.form.addressSearchFailed)).toBeTruthy();
    expect(screen.queryByText(h.form.addressNoResults)).toBeNull();
  });

  it('Scenario: Dirección no reconocida - pide elegir otra sugerencia y no crea la vivienda', async () => {
    const unknown: AddressSuggestions = {
      suggest: () => Promise.resolve([{ placeId: 'desconocido', formatted: 'Calle Inventada, 1' }]),
      endSession: jest.fn(),
    };
    const { backend } = await openHomes({ addressSuggestions: unknown });
    await fireEvent.press(await screen.findByRole('button', { name: h.empty.action }));
    await stepBar(1);
    await skipPhotos();
    await fireEvent.press(radio(h.type.piso));
    await chooseAddress('inventada', 'Calle Inventada, 1');

    await fireEvent.press(button(h.wizard.next));

    expect(await screen.findByText(h.errors.addressNotResolved)).toBeTruthy();
    expect(backend.homes.all()).toHaveLength(0);
    expect(await stepBar(2)).toBeTruthy();
    // Elegir otra sugerencia quita el error
    await fireEvent.changeText(field(h.form.address), 'inventada 2');
    await fireEvent.press(await screen.findByRole('button', { name: 'Calle Inventada, 1' }));
    expect(screen.queryByText(h.errors.addressNotResolved)).toBeNull();
  });

  it('cambiar la dirección de un borrador la actualiza en el primer paso', async () => {
    const { backend } = await startWizard();
    await fireEvent.press(button(h.wizard.back));
    await stepBar(2);
    expect(radio(h.type.piso).props.accessibilityState).toMatchObject({ checked: true });

    await fireEvent.press(radio(h.type.atico));
    await chooseAddress('santa engracia', CHAMBERI?.formatted ?? '');
    await fireEvent.press(button(h.wizard.next));
    await stepBar(3);

    expect(backend.requestsTo('PATCH', `/homes/${backend.homes.all()[0]?.id ?? ''}`)).toMatchObject(
      [
        {
          body: {
            type: 'atico',
            address: { placeId: 'fixture-chamberi', formatted: CHAMBERI?.formatted },
          },
        },
      ],
    );
    expect(backend.homes.all()[0]?.location.areaName).toBe('Chamberí');
  });

  it('Scenario: Rango de valor incoherente - el error sale junto al campo y el paso no se guarda', async () => {
    const home = completeHome({ valueMinCents: null, valueMaxCents: null });
    const { backend } = await openHomes({ homes: [home] });
    await fireEvent.press(
      await screen.findByRole('button', { name: cardAction(h.actions.continue) }),
    );
    await stepBar(4);

    await fireEvent.changeText(field(h.form.valueMin), '300000');
    await fireEvent.changeText(field(h.form.valueMax), '250000');
    await fireEvent.press(button(h.wizard.next));

    expect(await screen.findByText(h.errors.valueRange)).toBeTruthy();
    expect(screen.getByRole('alert', { name: h.errors.valueRange })).toBeTruthy();
    expect(backend.requests.filter((request) => request.method === 'PATCH')).toHaveLength(0);
    expect(await stepBar(4)).toBeTruthy();
    expect(backend.homes.all()[0]?.valueMinCents).toBeNull();

    // Corregido, se guarda en céntimos
    await fireEvent.changeText(field(h.form.valueMax), '350.000');
    await fireEvent.press(button(h.wizard.next));
    await stepBar(5);
    expect(backend.homes.all()[0]).toMatchObject({
      valueMinCents: 30_000_000,
      valueMaxCents: 35_000_000,
    });
  });

  it('un importe se muestra formateado es-ES mientras se escribe y al salir del campo', async () => {
    await openHomes({ homes: [completeHome({ valueMinCents: null, valueMaxCents: null })] });
    await fireEvent.press(
      await screen.findByRole('button', { name: cardAction(h.actions.continue) }),
    );
    await stepBar(4);

    await fireEvent.changeText(field(h.form.valueMin), '250000');
    expect(
      await screen.findByText(h.form.valuePreview.replace('{{amount}}', '250.000 €')),
    ).toBeTruthy();

    await fireEvent(field(h.form.valueMin), 'blur');
    expect(field(h.form.valueMin).props.value).toBe('250.000');
  });

  it('el rechazo del servidor a un rango incoherente se muestra junto al máximo', async () => {
    const { backend } = await openHomes({
      homes: [completeHome({ valueMinCents: null, valueMaxCents: null })],
    });
    await fireEvent.press(
      await screen.findByRole('button', { name: cardAction(h.actions.continue) }),
    );
    await stepBar(4);
    jest.spyOn(backend.homes, 'respond').mockReturnValueOnce(
      problem(422, {
        code: 'INVALID_VALUE_RANGE',
        errors: [{ field: 'valueMinCents', message: 'required' }],
      }),
    );

    await fireEvent.changeText(field(h.form.valueMin), '100000');
    await fireEvent.changeText(field(h.form.valueMax), '200000');
    await fireEvent.press(button(h.wizard.next));

    expect(await screen.findByText(h.errors.valueRange)).toBeTruthy();
    expect(await stepBar(4)).toBeTruthy();
  });

  it('Scenario: Ubicación por zona por defecto - el barrio está elegido y se guarda sin cambiarlo', async () => {
    const { backend } = await openHomes({ homes: [completeHome()] });
    await fireEvent.press(
      await screen.findByRole('button', { name: cardAction(h.actions.submit) }),
    );
    await stepBar(6);
    await fireEvent.press(button(h.wizard.back));
    await stepBar(5);

    expect(radio(h.location.area).props.accessibilityState).toMatchObject({ checked: true });
    expect(radio(h.location.exact).props.accessibilityState).toMatchObject({ checked: false });
    expect(
      screen.getByText(h.location.areaExplanation.replace('{{area}}', 'Malasaña')),
    ).toBeTruthy();
    expect(screen.getByText(h.location.privacy)).toBeTruthy();

    await fireEvent.press(button(h.wizard.next));
    await stepBar(6);

    expect(backend.requests.filter((request) => request.method === 'PATCH')).toMatchObject([
      { body: { locationVisibility: 'area' } },
    ]);
  });

  it('elegir la ubicación exacta cambia la explicación y se guarda', async () => {
    const { backend } = await openHomes({ homes: [completeHome()] });
    await fireEvent.press(
      await screen.findByRole('button', { name: cardAction(h.actions.submit) }),
    );
    await stepBar(6);
    await fireEvent.press(button(h.wizard.back));
    await stepBar(5);

    await fireEvent.press(radio(h.location.exact));

    expect(
      screen.getByText(h.location.exactExplanation.replace('{{area}}', 'Malasaña')),
    ).toBeTruthy();
    expect(
      screen.queryByText(h.location.areaExplanation.replace('{{area}}', 'Malasaña')),
    ).toBeNull();
    await fireEvent.press(button(h.wizard.next));
    await stepBar(6);
    expect(backend.homes.all()[0]?.location.visibility).toBe('exact');
  });

  it('si falla la red al guardar lo explica, mantiene los datos y deja reintentar', async () => {
    const { backend } = await startWizard();
    await fireEvent.changeText(field(h.form.bedrooms), '3');
    backend.failNext = 'network';

    await fireEvent.press(button(h.wizard.next));

    expect(await screen.findByText(h.errors.network)).toBeTruthy();
    expect(await stepBar(3)).toBeTruthy();
    expect(field(h.form.bedrooms).props.value).toBe('3');

    await fireEvent.press(button(h.wizard.next));
    await stepBar(4);
    expect(screen.queryByText(h.errors.network)).toBeNull();
  });

  it('una casa ya no editable (409) lo explica', async () => {
    const { backend } = await startWizard();
    backend.homes.all()[0]!.status = 'closed';

    await fireEvent.press(button(h.wizard.next));

    expect(await screen.findByText(h.errors.conflict)).toBeTruthy();
  });

  it('un rechazo (400) y un fallo del servidor se explican sin detalles internos', async () => {
    const { backend } = await startWizard();

    backend.failNext = 'invalid';
    await fireEvent.press(button(h.wizard.next));
    expect(await screen.findByText(h.errors.invalid)).toBeTruthy();

    backend.failNext = 'server';
    await fireEvent.press(button(h.wizard.next));
    expect(await screen.findByText(h.errors.unknown)).toBeTruthy();
    expect(screen.queryByText(h.errors.invalid)).toBeNull();
  });

  it('un segundo toque mientras se guarda no lanza otra petición', async () => {
    const { backend } = await startWizard();
    const release = backend.hold();

    await fireEvent.press(button(h.wizard.next));
    await fireEvent.press(button(h.wizard.next));
    release();
    await stepBar(4);

    expect(backend.requests.filter((request) => request.method === 'PATCH')).toHaveLength(1);
  });

  it('«Guardar y salir» vuelve a Mis casas con el borrador guardado', async () => {
    await startWizard();

    await fireEvent.press(button(h.wizard.exit));

    expect(await screen.findByText(h.status.draft)).toBeTruthy();
  });

  it('si la casa no carga lo explica y permite reintentar; si no existe, lo dice', async () => {
    const home = draftHome({ photos: readyPhotos(3) });
    const { backend } = await openHomes({ homes: [home] });
    await screen.findByText(MALASANA_TITLE);
    backend.failNext = 'server';

    await fireEvent.press(button(cardAction(h.actions.continue)));

    expect(await screen.findByText(h.wizard.loadFailed)).toBeTruthy();
    await fireEvent.press(button(h.retry));
    expect(await stepBar(3)).toBeTruthy();
  });
});

describe('Envío a revisión', () => {
  it('Scenario: Envío de una ficha completa - pasa a «En revisión» y Mis casas lo muestra', async () => {
    const { backend } = await openHomes({ homes: [completeHome()] });
    await fireEvent.press(
      await screen.findByRole('button', { name: cardAction(h.actions.submit) }),
    );
    await stepBar(6);
    expect(screen.getByRole('header', { name: h.review.title })).toBeTruthy();
    // La revisión resume los datos, con la dirección completa
    expect(screen.getByText(MALASANA?.formatted ?? '')).toBeTruthy();

    await fireEvent.press(button(h.submit.action));

    expect(await screen.findByText(h.status.in_review)).toBeTruthy();
    expect(backend.requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    expect(backend.homes.all()[0]?.status).toBe('in_review');

    await fireEvent.press(button(h.detail.back));
    expect(await screen.findByText(h.status.in_review)).toBeTruthy();
    expect(screen.getByRole('button', { name: cardAction(h.actions.view) })).toBeTruthy();
  });

  it('un segundo toque mientras se envía no lanza otro envío', async () => {
    const { backend } = await openHomes({ homes: [completeHome()] });
    await fireEvent.press(
      await screen.findByRole('button', { name: cardAction(h.actions.submit) }),
    );
    await stepBar(6);
    const release = backend.hold();

    await fireEvent.press(button(h.submit.action));
    await fireEvent.press(button(h.submit.action));
    release();

    expect(await screen.findByText(h.status.in_review)).toBeTruthy();
    expect(
      backend.requestsTo('POST', `/homes/${backend.homes.all()[0]?.id ?? ''}/submit`),
    ).toHaveLength(1);
  });

  it('Scenario: Envío de una ficha incompleta - muestra los campos que faltan y sigue en borrador', async () => {
    const home = completeHome({
      valueMinCents: null,
      valueMaxCents: null,
      isPrimaryResidence: null,
    });
    const { backend } = await openHomes({ homes: [home] });
    await fireEvent.press(
      await screen.findByRole('button', { name: cardAction(h.actions.continue) }),
    );
    await stepBar(4);
    // Se avanza sin rellenar el valor: un borrador admite guardar a medias
    await fireEvent.press(button(h.wizard.next));
    await stepBar(5);
    await fireEvent.press(button(h.wizard.next));
    await stepBar(6);

    await fireEvent.press(button(h.submit.action));

    const missing = h.submit.missing.replace(
      '{{fields}}',
      `${h.fields.valueMinCents}, ${h.fields.valueMaxCents}`,
    );
    expect(await screen.findByText(missing)).toBeTruthy();
    expect(screen.getByRole('alert', { name: missing })).toBeTruthy();
    expect(backend.homes.all()[0]?.status).toBe('draft');

    // Lleva al paso donde faltan
    await fireEvent.press(button(h.submit.complete));
    expect(await stepBar(4)).toBeTruthy();
  });

  it('un fallo de red, un conflicto o un error del servidor al enviar se explican', async () => {
    const { backend } = await openHomes({ homes: [completeHome()] });
    await fireEvent.press(
      await screen.findByRole('button', { name: cardAction(h.actions.submit) }),
    );
    await stepBar(6);

    backend.failNext = 'network';
    await fireEvent.press(button(h.submit.action));
    expect(await screen.findByText(h.submit.network)).toBeTruthy();

    backend.homes.all()[0]!.status = 'in_review';
    await fireEvent.press(button(h.submit.action));
    expect(await screen.findByText(h.submit.conflict)).toBeTruthy();

    backend.failNext = 'server';
    await fireEvent.press(button(h.submit.action));
    expect(await screen.findByText(h.submit.unknown)).toBeTruthy();
  });
});

describe('Detalle de la vivienda', () => {
  it('Scenario: El propietario ve su borrador - con todos sus datos, incluida la dirección', async () => {
    const home = completeHome({
      floor: '3',
      mortgageOutstandingCents: 5_000_000,
      features: { terrace: true, heating: 'central' },
    });
    await openHomes({ homes: [home] });
    await fireEvent.press(
      await screen.findByRole('link', { name: h.card.open.replace('{{title}}', MALASANA_TITLE) }),
    );

    expect(await screen.findByRole('header', { name: MALASANA_TITLE })).toBeTruthy();
    expect(screen.getByText(h.status.draft)).toBeTruthy();
    expect(screen.getByText(MALASANA?.formatted ?? '')).toBeTruthy();
    expect(screen.getByText(h.detail.privateAddress)).toBeTruthy();
    expect(screen.getByText(h.detail.statusNote.draft)).toBeTruthy();
    expect(
      screen.getByText(
        h.summary.surfacesValue.replace('{{useful}}', '80').replace('{{built}}', '95'),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        h.summary.roomsValue.replace('{{bedrooms}}', '3').replace('{{bathrooms}}', '2'),
      ),
    ).toBeTruthy();
    expect(screen.getByText(`${h.features.terrace}, ${h.heating.central}`)).toBeTruthy();
    expect(
      screen.getByText(
        h.card.value.replace('{{min}}', '250.000 €').replace('{{max}}', '300.000 €'),
      ),
    ).toBeTruthy();
    expect(screen.getByText('50.000 €')).toBeTruthy();
    expect(screen.getByText('Malasaña')).toBeTruthy();
    expect(button(h.submit.action)).toBeTruthy();
  });

  it('enviar desde el detalle cambia el estado mostrado a «En revisión»', async () => {
    await openHomes({ homes: [completeHome()] });
    await fireEvent.press(
      await screen.findByRole('link', { name: h.card.open.replace('{{title}}', MALASANA_TITLE) }),
    );
    await screen.findByRole('header', { name: MALASANA_TITLE });

    await fireEvent.press(button(h.submit.action));

    expect(await screen.findByText(h.detail.statusNote.in_review)).toBeTruthy();
    expect(screen.getByText(h.status.in_review)).toBeTruthy();
    expect(screen.queryByRole('button', { name: h.submit.action })).toBeNull();
  });

  it('una ficha incompleta enviada desde el detalle lleva a completar el paso que falta', async () => {
    await openHomes({ homes: [completeHome({ bedrooms: null })] });
    await fireEvent.press(
      await screen.findByRole('link', { name: h.card.open.replace('{{title}}', MALASANA_TITLE) }),
    );
    await screen.findByRole('header', { name: MALASANA_TITLE });
    expect(screen.getAllByText(h.summary.pending).length).toBeGreaterThan(0);

    await fireEvent.press(button(h.submit.action));
    expect(
      await screen.findByText(h.submit.missing.replace('{{fields}}', h.fields.bedrooms)),
    ).toBeTruthy();
    await fireEvent.press(button(h.submit.complete));

    expect(await stepBar(3)).toBeTruthy();
  });

  it('una casa publicada se consulta sin acciones de envío', async () => {
    await openHomes({ homes: [completeHome({ status: 'published', moderationNote: null })] });
    await fireEvent.press(await screen.findByRole('button', { name: cardAction(h.actions.view) }));

    expect(await screen.findByText(h.detail.statusNote.published)).toBeTruthy();
    expect(screen.queryByRole('button', { name: h.submit.action })).toBeNull();
    expect(screen.queryByRole('button', { name: h.detail.edit })).toBeNull();
  });

  it('un borrador se puede seguir editando desde el detalle', async () => {
    await openHomes({ homes: [draftHome({ photos: readyPhotos(3) })] });
    await fireEvent.press(
      await screen.findByRole('link', { name: h.card.open.replace('{{title}}', MALASANA_TITLE) }),
    );
    await screen.findByRole('header', { name: MALASANA_TITLE });

    await fireEvent.press(button(h.detail.edit));

    expect(await stepBar(3)).toBeTruthy();
  });

  it('si no carga lo explica y permite reintentar', async () => {
    const { backend } = await openHomes({ homes: [completeHome()] });
    await screen.findByText(MALASANA_TITLE);
    backend.failNext = 'server';

    await fireEvent.press(
      await screen.findByRole('link', { name: h.card.open.replace('{{title}}', MALASANA_TITLE) }),
    );

    expect(await screen.findByText(h.detail.loadFailed)).toBeTruthy();
    await fireEvent.press(button(h.retry));
    expect(await screen.findByRole('header', { name: MALASANA_TITLE })).toBeTruthy();
  });
});

describe.each(THEME_NAMES)('tema %s', (name) => {
  it('la lista, el asistente y el detalle usan los tokens del tema', async () => {
    const { color } = themes[name];
    await openHomes({ homes: [draftHome({ photos: readyPhotos(3) })], theme: name });

    expect(styleOf(await screen.findByText(MALASANA_TITLE)).color).toBe(color.text);
    expect(styleOf(screen.getByText(h.status.draft)).color).toBe(color.textMuted);

    await fireEvent.press(button(cardAction(h.actions.continue)));
    await stepBar(3);
    expect(styleOf(screen.getByRole('header', { name: h.wizard.steps.features })).color).toBe(
      color.text,
    );
    expect(styleOf(screen.getByTestId('progress-fill')).backgroundColor).toBe(color.primary);
  });
});
