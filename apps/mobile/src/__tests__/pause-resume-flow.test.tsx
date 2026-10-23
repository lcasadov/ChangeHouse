import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { Home } from '../features/homes/homes-api';
import es from '../i18n/locales/es-ES.json';
import { authUser, FakeAuthService } from '../test-support/fake-auth-service';
import { FakeBackend } from '../test-support/fake-backend';
import { completeHome, readyPhotos } from '../test-support/fake-homes';
import { problem } from '../test-support/http-responses';
import { renderSessionApp } from '../test-support/render-session-app';

// Flujos completos de la app (rutas, formularios y API simulada): el primero carga todos los módulos
jest.setTimeout(30_000);

const { homes: h } = es;
const MALASANA_TITLE = 'Piso en Malasaña';

const button = (name: string) => screen.getByRole('button', { name });
const field = (label: string) => screen.getByLabelText(label);
const radio = (name: string) => screen.getByRole('radio', { name });
const stepBar = (current: number) =>
  screen.findByRole('progressbar', {
    name: h.wizard.step.replace('{{current}}', String(current)).replace('{{total}}', '6'),
  });
const viewAction = h.card.action
  .replace('{{action}}', h.actions.view)
  .replace('{{title}}', MALASANA_TITLE);
const patches = (backend: FakeBackend) =>
  backend.requests.filter((request) => request.method === 'PATCH');

/** Una persona que abre el detalle de su única vivienda desde «Mis casas». */
async function openDetail(home: Home) {
  const backend = new FakeBackend({ registered: true, homes: [home] });
  await renderSessionApp({ auth: new FakeAuthService({ initialUser: authUser() }), backend });
  await fireEvent.press(await screen.findByRole('button', { name: es.tabs.homes }));
  await fireEvent.press(await screen.findByRole('button', { name: viewAction }));
  await screen.findByRole('header', { name: MALASANA_TITLE });
  return backend;
}

/** Desde el detalle, «Editar datos» abre el asistente en el tipo y la dirección. */
async function editUntilValue(backend: FakeBackend) {
  await fireEvent.press(button(h.detail.edit));
  await stepBar(2);
  await fireEvent.press(button(h.wizard.next));
  await stepBar(3);
  await fireEvent.press(button(h.wizard.next));
  await stepBar(4);
  expect(patches(backend)).toHaveLength(2);
}

describe('Pausar y reactivar desde el detalle', () => {
  it('Scenario: Pausar - explica qué supone, la pausa y «Mis casas» la muestra «Pausada»', async () => {
    const backend = await openDetail(completeHome({ status: 'published' }));

    expect(screen.getByText(h.detail.pause.hint)).toBeTruthy();
    expect(screen.queryByRole('button', { name: h.detail.resume.action })).toBeNull();
    await fireEvent.press(button(h.detail.pause.action));

    expect(await screen.findByText(h.detail.statusNote.paused)).toBeTruthy();
    expect(screen.getByText(h.status.paused)).toBeTruthy();
    expect(button(h.detail.resume.action)).toBeTruthy();
    expect(screen.queryByRole('button', { name: h.detail.pause.action })).toBeNull();
    expect(backend.homes.all()[0]?.status).toBe('paused');
    expect(backend.requests.some((request) => request.path.endsWith('/pause'))).toBe(true);

    await fireEvent.press(button(h.detail.back));
    expect(await screen.findByText(h.status.paused)).toBeTruthy();
  });

  it('Scenario: Reactivar - una vivienda pausada ofrece «Reactivar» y vuelve a publicada', async () => {
    const backend = await openDetail(completeHome({ status: 'paused' }));

    expect(screen.getByText(h.detail.resume.hint)).toBeTruthy();
    await fireEvent.press(button(h.detail.resume.action));

    expect(await screen.findByText(h.detail.statusNote.published)).toBeTruthy();
    expect(button(h.detail.pause.action)).toBeTruthy();
    expect(backend.homes.all()[0]?.status).toBe('published');
  });

  it('un borrador o una vivienda en revisión no ofrecen pausar ni reactivar', async () => {
    await openDetail(completeHome({ status: 'in_review' }));

    expect(screen.queryByRole('button', { name: h.detail.pause.action })).toBeNull();
    expect(screen.queryByRole('button', { name: h.detail.resume.action })).toBeNull();
  });

  it('si pausar falla lo explica, la casa sigue publicada y se puede reintentar', async () => {
    const backend = await openDetail(completeHome({ status: 'published' }));
    backend.failNext = 'network';

    await fireEvent.press(button(h.detail.pause.action));

    expect(await screen.findByText(h.detail.actionFailed)).toBeTruthy();
    expect(screen.getByText(h.detail.statusNote.published)).toBeTruthy();
    await fireEvent.press(button(h.detail.pause.action));
    expect(await screen.findByText(h.detail.statusNote.paused)).toBeTruthy();
    expect(screen.queryByText(h.detail.actionFailed)).toBeNull();
  });

  it('si la casa ya cambió de estado (409) lo explica', async () => {
    const backend = await openDetail(completeHome({ status: 'paused' }));
    jest.spyOn(backend.homes, 'respond').mockReturnValueOnce(problem(409));

    await fireEvent.press(button(h.detail.resume.action));

    expect(await screen.findByText(h.detail.stateChanged)).toBeTruthy();
  });

  it('un segundo toque mientras se pausa no lanza otra petición', async () => {
    const backend = await openDetail(completeHome({ status: 'published' }));

    await fireEvent.press(button(h.detail.pause.action));
    await fireEvent.press(button(h.detail.pause.action));

    await screen.findByText(h.detail.statusNote.paused);
    expect(backend.requests.filter((request) => request.path.endsWith('/pause'))).toHaveLength(1);
  });
});

describe('Editar una vivienda publicada', () => {
  it('Scenario: Cambiar el valor de una vivienda publicada - avisa antes de guardar de que volverá a revisión y, al confirmar, pasa a «En revisión»', async () => {
    const backend = await openDetail(completeHome({ status: 'published' }));
    await editUntilValue(backend);

    await fireEvent.changeText(field(h.form.valueMax), '320.000');
    await fireEvent.press(button(h.wizard.next));

    expect(await screen.findByLabelText(h.reReview.title)).toBeTruthy();
    expect(screen.getByText(h.reReview.description)).toBeTruthy();
    expect(patches(backend)).toHaveLength(2);

    await fireEvent.press(button(h.reReview.confirm));

    await stepBar(5);
    expect(backend.homes.all()[0]).toMatchObject({
      status: 'in_review',
      valueMaxCents: 32_000_000,
    });
    // Ya va a revisión: los pasos siguientes no vuelven a avisar
    await fireEvent.press(button(h.wizard.next));
    expect(await screen.findByText(h.detail.statusNote.in_review)).toBeTruthy();
    expect(screen.queryByLabelText(h.reReview.title)).toBeNull();
  });

  it('«Seguir editando» no guarda nada y deja el paso como estaba', async () => {
    const backend = await openDetail(completeHome({ status: 'published' }));
    await editUntilValue(backend);

    await fireEvent.changeText(field(h.form.valueMax), '320.000');
    await fireEvent.press(button(h.wizard.next));
    await screen.findByLabelText(h.reReview.title);
    await fireEvent.press(button(h.reReview.cancel));

    await waitFor(() => {
      expect(screen.queryByLabelText(h.reReview.title)).toBeNull();
    });
    expect(await stepBar(4)).toBeTruthy();
    expect(field(h.form.valueMax).props.value).toBe('320.000');
    expect(patches(backend)).toHaveLength(2);
    expect(backend.homes.all()[0]?.status).toBe('published');
  });

  it('Scenario: Cambiar solo la visibilidad de la ubicación - se guarda sin aviso, sigue publicada y vuelve al detalle', async () => {
    const backend = await openDetail(completeHome({ status: 'published' }));
    await editUntilValue(backend);
    await fireEvent.press(button(h.wizard.next));
    await stepBar(5);

    await fireEvent.press(radio(h.location.exact));
    await fireEvent.press(button(h.wizard.next));

    expect(await screen.findByText(h.detail.statusNote.published)).toBeTruthy();
    expect(screen.queryByLabelText(h.reReview.title)).toBeNull();
    expect(backend.homes.all()[0]).toMatchObject({
      status: 'published',
      location: { visibility: 'exact' },
    });
  });

  it('una vivienda pausada también se edita y avisa igual', async () => {
    const backend = await openDetail(completeHome({ status: 'paused' }));
    await fireEvent.press(button(h.detail.edit));
    await stepBar(2);
    await fireEvent.press(button(h.wizard.next));
    await stepBar(3);

    await fireEvent.changeText(field(h.form.bedrooms), '4');
    await fireEvent.press(button(h.wizard.next));
    await fireEvent.press(await screen.findByRole('button', { name: h.reReview.confirm }));

    await stepBar(4);
    expect(backend.homes.all()[0]).toMatchObject({ status: 'in_review', bedrooms: 4 });
  });

  it('en el primer paso de la edición no hay «Atrás» hacia las fotos y salir vuelve al detalle', async () => {
    await openDetail(completeHome({ status: 'published' }));
    await fireEvent.press(button(h.detail.edit));
    await stepBar(2);

    expect(screen.queryByRole('button', { name: h.wizard.back })).toBeNull();
    await fireEvent.press(button(h.wizard.exit));
    expect(await screen.findByRole('header', { name: MALASANA_TITLE })).toBeTruthy();
  });

  it('las fotos de una vivienda publicada avisan antes de cambiarlas de que volverá a revisión', async () => {
    await openDetail(completeHome({ status: 'published', photos: readyPhotos(4) }));

    await fireEvent.press(button(h.detail.managePhotos));

    expect(await screen.findByText(h.reReview.photosNotice)).toBeTruthy();
  });
});
