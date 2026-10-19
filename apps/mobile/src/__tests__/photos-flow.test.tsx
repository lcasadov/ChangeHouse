import { FIXTURE_PLACES } from '@changehouse/shared';
import { themes } from '@changehouse/ui';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { firstIncompleteStep } from '../features/homes/home-form';
import type { Home } from '../features/homes/homes-api';
import es from '../i18n/locales/es-ES.json';
import { authUser, FakeAuthService } from '../test-support/fake-auth-service';
import { FakeBackend } from '../test-support/fake-backend';
import { completeHome, draftHome, readyPhotos } from '../test-support/fake-homes';
import { FakePhotoPicker, FakePhotoUploader, pickedPhoto } from '../test-support/fake-photos';
import { renderSessionApp } from '../test-support/render-session-app';
import { styleOf, THEME_NAMES } from '../test-utils';

// Flujos completos de la app (rutas, formularios y API simulada): el primero carga todos los módulos
jest.setTimeout(30_000);

const { homes: h } = es;
const { photos: p } = h;

const MALASANA = FIXTURE_PLACES[0];
const MALASANA_TITLE = 'Piso en Malasaña';

const button = (name: string) => screen.getByRole('button', { name });
const counter = (count: number) => p.counter.replace('{{count}}', String(count));
const stepBar = (current: number) =>
  screen.findByRole('progressbar', {
    name: h.wizard.step.replace('{{current}}', String(current)).replace('{{total}}', '6'),
  });
const cardAction = (action: string) =>
  h.card.action.replace('{{action}}', action).replace('{{title}}', MALASANA_TITLE);
const coverLabel = (total: number) => p.coverTile.replace('{{total}}', String(total));
const tileLabel = (position: number, total: number) =>
  p.tile.replace('{{position}}', String(position)).replace('{{total}}', String(total));
const uploadingLabel = (position: number, total: number, percent: number) =>
  p.uploadingTile
    .replace('{{position}}', String(position))
    .replace('{{total}}', String(total))
    .replace('{{status}}', p.status.uploading.replace('{{percent}}', String(percent)));
const removeLabel = (position: number) => p.remove.replace('{{position}}', String(position));
const retryLabel = (position: number) => p.retryLabel.replace('{{position}}', String(position));
const discardLabel = (position: number) => p.discardLabel.replace('{{position}}', String(position));

interface OpenOptions {
  homes?: readonly Home[];
  theme?: 'light' | 'dark';
}

/** Una persona dada de alta con la galería y el envío de ficheros simulados, en «Mis casas». */
async function openHomes({ homes = [], theme }: OpenOptions = {}) {
  const auth = new FakeAuthService({ initialUser: authUser() });
  const backend = new FakeBackend({ registered: true, homes });
  const picker = new FakePhotoPicker();
  const uploader = new FakePhotoUploader(backend);
  await renderSessionApp({
    auth,
    backend,
    photoPicker: picker,
    photoUploader: uploader,
    ...(theme ? { theme } : {}),
  });
  await fireEvent.press(await screen.findByRole('button', { name: es.tabs.homes }));
  return { backend, picker, uploader };
}

/** Abre el paso de fotos de un borrador con menos de 3 fotos desde «Continuar». */
async function openPhotosStep(options: OpenOptions) {
  const opened = await openHomes(options);
  await fireEvent.press(
    await screen.findByRole('button', { name: cardAction(h.actions.continue) }),
  );
  // «Continuar» abre el primer paso incompleto: con 3 fotos o más hay que volver hasta las fotos
  for (let step = firstIncompleteStep(options.homes?.[0] ?? draftHome()); step > 1; step -= 1) {
    await stepBar(step);
    await fireEvent.press(button(h.wizard.back));
  }
  await stepBar(1);
  return opened;
}

const photoRequests = (backend: FakeBackend) =>
  backend.requests.filter((request) => request.path.includes('/photos'));

describe('Paso de fotos', () => {
  it('Scenario: Subir una foto - muestra el progreso y, al terminar, la foto aparece en la vivienda', async () => {
    const { backend, picker, uploader } = await openPhotosStep({ homes: [draftHome()] });
    expect(screen.getByRole('header', { name: h.wizard.steps.photos })).toBeTruthy();
    expect(screen.getByText(counter(0))).toBeTruthy();
    picker.choose(pickedPhoto('salon.jpg'));
    const release = uploader.hold();

    await fireEvent.press(button(p.add));

    // Progreso por foto, anunciado como barra de progreso con su valor
    const progress = await screen.findByRole('progressbar', { name: uploadingLabel(1, 1, 40) });
    expect(progress.props.accessibilityValue).toMatchObject({ min: 0, max: 100, now: 40 });
    expect(screen.getByText(p.status.uploading.replace('{{percent}}', '40'))).toBeTruthy();

    release();

    expect(await screen.findByLabelText(coverLabel(1))).toBeTruthy();
    expect(screen.getByText(p.cover)).toBeTruthy();
    expect(screen.getByText(counter(1))).toBeTruthy();
    expect(screen.queryByRole('progressbar', { name: uploadingLabel(1, 1, 40) })).toBeNull();
    expect(photoRequests(backend)).toMatchObject([
      { method: 'POST', body: { contentType: 'image/jpeg' } },
      { method: 'POST' },
    ]);
    expect(uploader.uploads).toMatchObject([
      { contentType: 'image/jpeg', uri: 'file:///galeria/salon.jpg' },
    ]);
    expect(backend.homes.all()[0]?.photos).toHaveLength(1);
  });

  it('elige varias fotos a la vez, limita la galería a las que caben y la primera es la portada', async () => {
    const { picker } = await openPhotosStep({ homes: [draftHome({ photos: readyPhotos(2) })] });
    picker.choose(
      pickedPhoto('a.jpg'),
      pickedPhoto('b.png', 'image/png'),
      pickedPhoto('c.webp', 'image/webp'),
    );

    await fireEvent.press(button(p.add));

    expect(await screen.findByLabelText(tileLabel(5, 5))).toBeTruthy();
    expect(screen.getByText(counter(5))).toBeTruthy();
    expect(picker.limits).toEqual([18]);
    expect(screen.getByLabelText(coverLabel(5))).toBeTruthy();
    expect(screen.getAllByText(p.cover)).toHaveLength(1);
  });

  it('con menos de 3 fotos recuerda el mínimo', async () => {
    await openPhotosStep({ homes: [draftHome({ photos: readyPhotos(2) })] });

    expect(screen.getByText(p.minHint)).toBeTruthy();
  });

  it('con 3 fotos no recuerda el mínimo y el asistente pasa al tipo y la dirección', async () => {
    await openHomes({ homes: [draftHome({ photos: readyPhotos(3) })] });
    await fireEvent.press(
      await screen.findByRole('button', { name: cardAction(h.actions.continue) }),
    );
    await stepBar(3);
    await fireEvent.press(button(h.wizard.back));
    await stepBar(2);
    await fireEvent.press(button(h.wizard.back));
    await stepBar(1);

    expect(screen.queryByText(p.minHint)).toBeNull();
    await fireEvent.press(button(h.wizard.next));
    expect(await stepBar(2)).toBeTruthy();
    expect(screen.getByRole('header', { name: h.wizard.steps.type })).toBeTruthy();
  });

  it('Scenario: Límite de 20 fotos - con 20 no deja añadir y lo explica', async () => {
    const { picker } = await openPhotosStep({ homes: [draftHome({ photos: readyPhotos(20) })] });

    expect(screen.getByText(counter(20))).toBeTruthy();
    expect(screen.getByText(p.limitReached)).toBeTruthy();
    const add = button(p.add);
    expect(add.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(add);
    expect(picker.limits).toEqual([]);
  });

  it('Scenario: Límite de 20 fotos - si la API responde 409 la foto lo explica y solo ofrece quitarla', async () => {
    const { backend, picker } = await openPhotosStep({
      homes: [draftHome({ photos: readyPhotos(19) })],
    });
    // Otro dispositivo llegó al límite mientras tanto
    const stored = backend.homes.all()[0];
    if (stored) stored.photos = readyPhotos(20);
    picker.choose(pickedPhoto('extra.jpg'));

    await fireEvent.press(button(p.add));

    expect(await screen.findByText(p.failures.limit)).toBeTruthy();
    expect(screen.queryByRole('button', { name: retryLabel(20) })).toBeNull();
    await fireEvent.press(button(discardLabel(20)));
    expect(screen.queryByText(p.failures.limit)).toBeNull();
    expect(screen.getByText(counter(19))).toBeTruthy();
  });

  it('GIVEN una subida que falla WHEN se muestra THEN la foto ofrece «Reintentar» sin perder las demás', async () => {
    const { picker, uploader, backend } = await openPhotosStep({ homes: [draftHome()] });
    picker.choose(pickedPhoto('a.jpg'), pickedPhoto('b.jpg'));
    uploader.failures = 1;

    await fireEvent.press(button(p.add));

    expect(await screen.findByText(p.failures.upload)).toBeTruthy();
    await waitFor(() => {
      expect(backend.homes.all()[0]?.photos).toHaveLength(1);
    });
    expect(await screen.findByLabelText(coverLabel(2))).toBeTruthy();
    expect(screen.getByText(counter(2))).toBeTruthy();

    await fireEvent.press(button(retryLabel(2)));

    await waitFor(() => {
      expect(backend.homes.all()[0]?.photos).toHaveLength(2);
    });
    await waitFor(() => {
      expect(screen.queryByText(p.failures.upload)).toBeNull();
    });
    expect(await screen.findByLabelText(tileLabel(2, 2))).toBeTruthy();
  });

  it('Scenario: Fichero que no es una imagen - la foto no se publica y solo se puede quitar', async () => {
    const { picker, backend } = await openPhotosStep({ homes: [draftHome()] });
    picker.choose(pickedPhoto('apuntes.txt'));

    await fireEvent.press(button(p.add));

    expect(await screen.findByText(p.failures.invalidImage)).toBeTruthy();
    expect(backend.homes.all()[0]?.photos).toHaveLength(0);
    expect(screen.queryByRole('button', { name: retryLabel(1) })).toBeNull();
    await fireEvent.press(button(discardLabel(1)));
    expect(screen.queryByText(p.failures.invalidImage)).toBeNull();
    expect(screen.getByText(counter(0))).toBeTruthy();
  });

  it('un formato que la API no admite se rechaza sin pedir ninguna subida', async () => {
    const { picker, backend } = await openPhotosStep({ homes: [draftHome()] });
    picker.choose(pickedPhoto('animada.gif', 'image/gif'));

    await fireEvent.press(button(p.add));

    expect(await screen.findByText(p.failures.unsupported)).toBeTruthy();
    expect(photoRequests(backend)).toHaveLength(0);
  });

  it('si la subida no llega completa permite reintentar', async () => {
    const { picker, uploader, backend } = await openPhotosStep({ homes: [draftHome()] });
    picker.choose(pickedPhoto('a.jpg'));
    // El envío «termina» pero el almacenamiento no recibió el fichero
    jest.spyOn(uploader, 'upload').mockResolvedValueOnce();

    await fireEvent.press(button(p.add));

    expect(await screen.findByText(p.failures.notUploaded)).toBeTruthy();
    await fireEvent.press(button(retryLabel(1)));
    await waitFor(() => {
      expect(backend.homes.all()[0]?.photos).toHaveLength(1);
    });
  });

  it('un fallo de red al pedir la subida se explica y deja reintentar', async () => {
    const { picker, backend } = await openPhotosStep({ homes: [draftHome()] });
    picker.choose(pickedPhoto('a.jpg'));
    backend.failNext = 'network';

    await fireEvent.press(button(p.add));

    expect(await screen.findByText(p.failures.network)).toBeTruthy();
    await fireEvent.press(button(retryLabel(1)));
    await waitFor(() => {
      expect(backend.homes.all()[0]?.photos).toHaveLength(1);
    });
  });

  it('un fallo inesperado del servidor se explica sin detalles internos', async () => {
    const { picker, backend } = await openPhotosStep({ homes: [draftHome()] });
    picker.choose(pickedPhoto('a.jpg'));
    backend.failNext = 'server';

    await fireEvent.press(button(p.add));

    expect(await screen.findByText(p.failures.unknown)).toBeTruthy();
  });

  it('si la vivienda ya no admite cambios (409) lo explica y solo ofrece quitar la foto', async () => {
    const { picker, backend } = await openPhotosStep({ homes: [draftHome()] });
    picker.choose(pickedPhoto('a.jpg'));
    const stored = backend.homes.all()[0];
    if (stored) stored.status = 'closed';

    await fireEvent.press(button(p.add));

    expect(await screen.findByText(p.failures.notEditable)).toBeTruthy();
    expect(screen.queryByRole('button', { name: retryLabel(1) })).toBeNull();
  });

  it('si no se puede abrir la galería lo explica', async () => {
    const { picker } = await openPhotosStep({ homes: [draftHome()] });
    picker.fails = true;

    await fireEvent.press(button(p.add));

    expect(await screen.findByText(p.pickFailed)).toBeTruthy();
  });

  it('cancelar la galería no cambia nada', async () => {
    const { picker } = await openPhotosStep({ homes: [draftHome()] });

    await fireEvent.press(button(p.add));

    await waitFor(() => {
      expect(picker.limits).toEqual([20]);
    });
    expect(screen.getByText(counter(0))).toBeTruthy();
    expect(screen.queryByText(p.pickFailed)).toBeNull();
  });

  it('quitar una foto pide confirmación que nombra lo que se borra y solo entonces la elimina', async () => {
    const { backend } = await openPhotosStep({ homes: [draftHome({ photos: readyPhotos(4) })] });

    await fireEvent.press(button(removeLabel(2)));
    expect(await screen.findByText(p.delete.title)).toBeTruthy();
    expect(screen.getByText(p.delete.description)).toBeTruthy();
    expect(backend.requests.filter((request) => request.method === 'DELETE')).toHaveLength(0);

    // Cancelar no borra nada
    await fireEvent.press(button(p.delete.cancel));
    expect(backend.requests.filter((request) => request.method === 'DELETE')).toHaveLength(0);
    expect(screen.getByText(counter(4))).toBeTruthy();

    await fireEvent.press(button(removeLabel(2)));
    await fireEvent.press(button(p.delete.confirm));

    expect(await screen.findByText(counter(3))).toBeTruthy();
    expect(backend.homes.all()[0]?.photos).toHaveLength(3);
    expect(screen.queryByText(p.delete.title)).toBeNull();
  });

  it('si borrar falla por la red lo explica y mantiene la foto', async () => {
    const { backend } = await openPhotosStep({ homes: [draftHome({ photos: readyPhotos(4) })] });
    await fireEvent.press(button(removeLabel(1)));
    backend.failNext = 'network';

    await fireEvent.press(button(p.delete.confirm));

    expect(await screen.findByText(p.delete.failed)).toBeTruthy();
    expect(screen.getByText(counter(4))).toBeTruthy();
  });

  it('los botones de las fotos tienen un objetivo táctil de al menos 44 puntos', async () => {
    await openPhotosStep({ homes: [draftHome({ photos: readyPhotos(1) })] });

    const remove = styleOf(button(removeLabel(1)));

    expect(remove.minHeight).toBeGreaterThanOrEqual(44);
    expect(remove.minWidth).toBeGreaterThanOrEqual(44);
  });
});

describe('Fotos de una vivienda publicada', () => {
  async function openPublishedPhotos(photos = 3) {
    const opened = await openHomes({
      homes: [completeHome({ status: 'published', photos: readyPhotos(photos) })],
    });
    await fireEvent.press(await screen.findByRole('button', { name: cardAction(h.actions.view) }));
    await screen.findByRole('header', { name: MALASANA_TITLE });
    await fireEvent.press(button(h.detail.managePhotos));
    await screen.findByText(counter(photos));
    return opened;
  }

  it('Scenario: Borrar por debajo del mínimo en una vivienda publicada - la API responde 409 y la foto se mantiene', async () => {
    const { backend } = await openPublishedPhotos(3);

    await fireEvent.press(button(removeLabel(3)));
    await fireEvent.press(button(p.delete.confirm));

    expect(await screen.findByText(p.delete.minimum)).toBeTruthy();
    expect(screen.getByText(counter(3))).toBeTruthy();
    expect(screen.queryByText(p.delete.title)).toBeNull();
    expect(backend.homes.all()[0]?.photos).toHaveLength(3);
  });

  it('con más de 3 fotos permite borrar una y «Listo» vuelve al detalle', async () => {
    const { backend } = await openPublishedPhotos(4);

    await fireEvent.press(button(removeLabel(4)));
    await fireEvent.press(button(p.delete.confirm));
    expect(await screen.findByText(counter(3))).toBeTruthy();
    expect(backend.homes.all()[0]?.photos).toHaveLength(3);

    expect(screen.queryByRole('button', { name: h.wizard.next })).toBeNull();
    await fireEvent.press(button(p.done));
    expect(await screen.findByRole('header', { name: MALASANA_TITLE })).toBeTruthy();
  });

  it('el detalle de una vivienda en revisión no ofrece gestionar fotos', async () => {
    await openHomes({ homes: [completeHome({ status: 'in_review' })] });
    await fireEvent.press(await screen.findByRole('button', { name: cardAction(h.actions.view) }));
    await screen.findByRole('header', { name: MALASANA_TITLE });

    expect(screen.queryByRole('button', { name: h.detail.managePhotos })).toBeNull();
  });
});

describe('Envío con fotos', () => {
  it('Scenario: Envío con menos de 3 fotos - indica que faltan fotos, sigue en borrador y lleva al paso de fotos', async () => {
    const { backend } = await openHomes({ homes: [completeHome({ photos: readyPhotos(2) })] });
    await fireEvent.press(
      await screen.findByRole('link', { name: h.card.open.replace('{{title}}', MALASANA_TITLE) }),
    );
    await screen.findByRole('header', { name: MALASANA_TITLE });

    await fireEvent.press(button(h.submit.action));

    const missing = h.submit.missing.replace('{{fields}}', h.fields.photos);
    expect(await screen.findByText(missing)).toBeTruthy();
    expect(backend.homes.all()[0]?.status).toBe('draft');

    await fireEvent.press(button(h.submit.complete));
    expect(await stepBar(1)).toBeTruthy();
    expect(screen.getByRole('header', { name: h.wizard.steps.photos })).toBeTruthy();
  });

  it('un borrador completo con 3 fotos va a la revisión final', async () => {
    await openHomes({ homes: [completeHome()] });

    await fireEvent.press(
      await screen.findByRole('button', { name: cardAction(h.actions.submit) }),
    );

    expect(await stepBar(6)).toBeTruthy();
  });
});

describe('Alta de una casa nueva', () => {
  async function startNewHome() {
    const opened = await openHomes();
    await fireEvent.press(await screen.findByRole('button', { name: h.empty.action }));
    await stepBar(1);
    return opened;
  }

  async function chooseTypeAndAddress() {
    await fireEvent.press(screen.getByRole('radio', { name: h.type.piso }));
    await fireEvent.changeText(screen.getByLabelText(h.form.address), 'pez');
    await fireEvent.press(await screen.findByRole('button', { name: MALASANA?.formatted ?? '' }));
  }

  it('las fotos son el primer paso: se eligen antes de que exista la vivienda y se suben al crearla', async () => {
    const { backend, picker } = await startNewHome();
    expect(screen.getByRole('header', { name: h.wizard.steps.photos })).toBeTruthy();
    picker.choose(pickedPhoto('a.jpg'), pickedPhoto('b.jpg'), pickedPhoto('c.jpg'));

    await fireEvent.press(button(p.add));

    // Aún no hay borrador: las fotos esperan en el dispositivo
    expect(await screen.findAllByText(p.status.queued)).toHaveLength(3);
    expect(screen.getByText(counter(3))).toBeTruthy();
    expect(photoRequests(backend)).toHaveLength(0);

    await fireEvent.press(button(h.wizard.next));
    await stepBar(2);
    expect(screen.getByRole('header', { name: h.wizard.steps.type })).toBeTruthy();
    await chooseTypeAndAddress();
    await fireEvent.press(button(h.wizard.next));
    await stepBar(3);

    await waitFor(() => {
      expect(backend.homes.all()[0]?.photos).toHaveLength(3);
    });
    expect(backend.requestsTo('POST', '/homes')).toHaveLength(1);
    // Al volver al primer paso están las tres, la primera como portada
    await fireEvent.press(button(h.wizard.back));
    await stepBar(2);
    await fireEvent.press(button(h.wizard.back));
    await stepBar(1);
    expect(await screen.findByLabelText(coverLabel(3))).toBeTruthy();
    expect(screen.getByText(counter(3))).toBeTruthy();
  });

  it('mientras suben las fotos los demás pasos lo anuncian y avisan si alguna falla', async () => {
    const { picker, uploader } = await startNewHome();
    picker.choose(pickedPhoto('a.jpg'), pickedPhoto('b.jpg'));
    await fireEvent.press(button(p.add));
    await screen.findAllByText(p.status.queued);
    await fireEvent.press(button(h.wizard.next));
    await stepBar(2);
    await chooseTypeAndAddress();
    uploader.failures = 1;
    const release = uploader.hold();

    await fireEvent.press(button(h.wizard.next));
    await stepBar(3);

    expect(
      await screen.findByText(p.banner.uploading_other.replace('{{count}}', '2')),
    ).toBeTruthy();
    release();
    expect(await screen.findByText(p.banner.failed_one.replace('{{count}}', '1'))).toBeTruthy();

    await fireEvent.press(button(p.banner.show));
    expect(await stepBar(1)).toBeTruthy();
    expect(await screen.findByText(p.failures.upload)).toBeTruthy();
  });

  it('salir con fotos sin subir pide confirmación; seguir aquí no descarta nada', async () => {
    const { picker } = await startNewHome();
    picker.choose(pickedPhoto('a.jpg'));
    await fireEvent.press(button(p.add));
    await screen.findAllByText(p.status.queued);

    await fireEvent.press(button(h.wizard.exit));
    expect(await screen.findByText(p.exit.title)).toBeTruthy();
    await fireEvent.press(button(p.exit.cancel));
    expect(screen.queryByText(p.exit.title)).toBeNull();
    expect(screen.getByText(counter(1))).toBeTruthy();

    await fireEvent.press(button(h.wizard.exit));
    await fireEvent.press(button(p.exit.confirm));
    expect(await screen.findByText(h.empty.title)).toBeTruthy();
  });

  it('salir sin fotos pendientes no pide confirmación', async () => {
    await startNewHome();

    await fireEvent.press(button(h.wizard.exit));

    expect(await screen.findByText(h.empty.title)).toBeTruthy();
  });
});

describe('Portada en Mis casas y en el detalle', () => {
  it('la tarjeta muestra la primera foto como portada, o el marcador si no hay fotos', async () => {
    await openHomes({ homes: [draftHome(), completeHome({ status: 'published' })] });

    const cover = await screen.findByTestId('home-cover');

    expect(cover.props.source).toEqual({ uri: 'https://cdn.changehouse.test/photos/1.webp' });
    expect(screen.getAllByText(h.card.noPhotos)).toHaveLength(1);
  });

  it('el detalle del propietario muestra la portada y las demás fotos con texto alternativo', async () => {
    await openHomes({ homes: [completeHome({ status: 'published' })] });
    await fireEvent.press(await screen.findByRole('button', { name: cardAction(h.actions.view) }));
    await screen.findByRole('header', { name: MALASANA_TITLE });

    expect(screen.getByLabelText(p.coverAlt.replace('{{title}}', MALASANA_TITLE))).toBeTruthy();
    for (const position of [2, 3]) {
      expect(
        screen.getByLabelText(
          p.galleryAlt
            .replace('{{position}}', String(position))
            .replace('{{total}}', '3')
            .replace('{{title}}', MALASANA_TITLE),
        ),
      ).toBeTruthy();
    }
  });
});

describe.each(THEME_NAMES)('tema %s', (name) => {
  it('el paso de fotos usa los tokens del tema', async () => {
    const { color } = themes[name];
    await openPhotosStep({ homes: [draftHome({ photos: readyPhotos(1) })], theme: name });

    expect(styleOf(screen.getByRole('header', { name: h.wizard.steps.photos })).color).toBe(
      color.text,
    );
    expect(styleOf(screen.getByText(counter(1))).color).toBe(color.textMuted);
    expect(styleOf(screen.getByTestId('photo-tile-1')).borderColor).toBe(color.border);
  });
});
