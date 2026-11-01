import { createApiClient } from '../../api/client';
import { FakeBackend } from '../../test-support/fake-backend';
import { completeHome, draftHome, readyPhotos } from '../../test-support/fake-homes';
import { problem } from '../../test-support/http-responses';
import { type Home, HomesApiError } from './homes-api';
import { createHttpHomesApi } from './http-homes-api';

function setup(backend: FakeBackend) {
  return createHttpHomesApi(
    createApiClient({
      baseUrl: 'https://api.test',
      getToken: () => Promise.resolve('token'),
      fetch: backend.fetch,
    }),
  );
}

const ADDRESS = { placeId: 'fixture-malasana', formatted: 'Calle del Pez, 12' };

async function failureOf(action: Promise<unknown>): Promise<HomesApiError | string> {
  try {
    await action;
  } catch (error) {
    return error instanceof HomesApiError ? error : 'otro-error';
  }
  return 'sin-error';
}

describe('listMine', () => {
  it('devuelve las viviendas propias (GET /me/homes)', async () => {
    const backend = new FakeBackend({ homes: [draftHome(), completeHome()] });

    const homes = await setup(backend).listMine();

    expect(homes).toHaveLength(2);
    expect(backend.requests).toMatchObject([
      { method: 'GET', path: '/me/homes', authorization: 'Bearer token' },
    ]);
  });

  it('devuelve una lista vacía si no hay viviendas', async () => {
    expect(await setup(new FakeBackend()).listMine()).toEqual([]);
  });

  it.each([
    ['unauthorized', 'unauthorized'],
    ['server', 'server'],
    ['network', 'network'],
  ] as const)('traduce el fallo %s a %s', async (failure, kind) => {
    const backend = new FakeBackend();
    backend.failNext = failure;

    expect(await failureOf(setup(backend).listMine())).toMatchObject({ kind });
  });
});

describe('get', () => {
  it('devuelve la ficha completa de una vivienda propia (GET /homes/{id})', async () => {
    const home = draftHome();
    const backend = new FakeBackend({ homes: [home] });

    expect(await setup(backend).get(home.id)).toMatchObject({ id: home.id, status: 'draft' });
    expect(backend.requests).toMatchObject([{ method: 'GET', path: `/homes/${home.id}` }]);
  });

  it('una vivienda que no existe es not-found (404)', async () => {
    expect(await failureOf(setup(new FakeBackend()).get('no-existe'))).toMatchObject({
      kind: 'not-found',
    });
  });

  it('la forma pública de una vivienda ajena no es una ficha propia: not-found', async () => {
    const publicForm: Partial<Home> = completeHome();
    delete publicForm.status;
    delete publicForm.address;
    const api = createHttpHomesApi(
      createApiClient({
        baseUrl: 'https://api.test',
        getToken: () => Promise.resolve('token'),
        fetch: () =>
          Promise.resolve(
            new Response(JSON.stringify(publicForm), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          ),
      }),
    );

    expect(await failureOf(api.get('cualquiera'))).toMatchObject({ kind: 'not-found' });
  });
});

describe('create', () => {
  it('envía POST /homes con tipo y dirección y devuelve el borrador (201)', async () => {
    const backend = new FakeBackend();

    const home = await setup(backend).create({ type: 'piso', address: ADDRESS });

    expect(home).toMatchObject({ status: 'draft', type: 'piso' });
    expect(backend.requestsTo('POST', '/homes')).toMatchObject([
      { body: { type: 'piso', address: ADDRESS } },
    ]);
  });

  it('una dirección que el servidor no resuelve es address-not-resolved (422)', async () => {
    const failure = await failureOf(
      setup(new FakeBackend()).create({
        type: 'piso',
        address: { placeId: 'desconocido', formatted: 'Calle Inventada, 1' },
      }),
    );

    expect(failure).toMatchObject({ kind: 'address-not-resolved' });
  });

  it('un cuerpo rechazado (400) es invalid', async () => {
    const backend = new FakeBackend();
    backend.failNext = 'invalid';

    expect(
      await failureOf(setup(backend).create({ type: 'piso', address: ADDRESS })),
    ).toMatchObject({ kind: 'invalid' });
  });
});

describe('update', () => {
  it('envía PATCH /homes/{id} con el paso y devuelve la vivienda', async () => {
    const home = draftHome();
    const backend = new FakeBackend({ homes: [home] });

    const updated = await setup(backend).update(home.id, { bedrooms: 3, hasLift: true });

    expect(updated).toMatchObject({ bedrooms: 3, hasLift: true });
    expect(backend.requestsTo('PATCH', `/homes/${home.id}`)).toMatchObject([
      { body: { bedrooms: 3, hasLift: true } },
    ]);
  });

  it('un rango incoherente es invalid-value-range con los campos señalados (422)', async () => {
    const home = draftHome();

    const failure = await failureOf(
      setup(new FakeBackend({ homes: [home] })).update(home.id, {
        valueMinCents: 30_000_000,
        valueMaxCents: 25_000_000,
      }),
    );

    expect(failure).toMatchObject({
      kind: 'invalid-value-range',
      fields: ['valueMinCents', 'valueMaxCents'],
    });
  });

  it('Scenario: Valor por encima del máximo legal - es above-legal-price con el campo señalado (422)', async () => {
    const home = draftHome();
    const backend = new FakeBackend({ homes: [home] });
    jest.spyOn(backend.homes, 'respond').mockReturnValueOnce(
      problem(422, {
        code: 'VALUE_ABOVE_VPP_MAX_LEGAL_PRICE',
        errors: [{ field: 'valueMaxCents', message: 'required' }],
      }),
    );

    const failure = await failureOf(setup(backend).update(home.id, { valueMaxCents: 1 }));

    expect(failure).toMatchObject({ kind: 'above-legal-price', fields: ['valueMaxCents'] });
  });

  it('una vivienda en operación es conflict (409)', async () => {
    const home = draftHome({ status: 'in_operation' });

    expect(
      await failureOf(setup(new FakeBackend({ homes: [home] })).update(home.id, { bedrooms: 1 })),
    ).toMatchObject({ kind: 'conflict' });
  });

  it('una vivienda ajena o inexistente es not-found (404)', async () => {
    expect(
      await failureOf(setup(new FakeBackend()).update('no-existe', { bedrooms: 1 })),
    ).toMatchObject({ kind: 'not-found' });
  });
});

describe('submit', () => {
  it('envía POST /homes/{id}/submit y devuelve la vivienda en revisión', async () => {
    const home = completeHome();
    const backend = new FakeBackend({ homes: [home] });

    const submitted = await setup(backend).submit(home.id);

    expect(submitted.status).toBe('in_review');
    expect(backend.requests).toMatchObject([{ method: 'POST', path: `/homes/${home.id}/submit` }]);
  });

  it('una ficha incompleta es incomplete con los campos que faltan (422)', async () => {
    const home = completeHome({ valueMinCents: null, valueMaxCents: null });

    const failure = await failureOf(setup(new FakeBackend({ homes: [home] })).submit(home.id));

    expect(failure).toMatchObject({
      kind: 'incomplete',
      fields: ['valueMinCents', 'valueMaxCents'],
    });
  });

  it('Scenario: VPP sin fecha de calificación - el 400 de la API es incomplete con el campo de la fecha', async () => {
    const home = completeHome({ regime: 'VPPL' });
    const backend = new FakeBackend({ homes: [home] });
    jest.spyOn(backend.homes, 'respond').mockReturnValueOnce(
      problem(400, {
        code: 'VPP_QUALIFICATION_DATE_REQUIRED',
        errors: [{ field: 'vppQualificationDate', message: 'required' }],
      }),
    );

    const failure = await failureOf(setup(backend).submit(home.id));

    expect(failure).toMatchObject({ kind: 'incomplete', fields: ['vppQualificationDate'] });
  });

  it('una vivienda que ya no es borrador es conflict (409)', async () => {
    const home = completeHome({ status: 'in_review' });

    expect(
      await failureOf(setup(new FakeBackend({ homes: [home] })).submit(home.id)),
    ).toMatchObject({
      kind: 'conflict',
    });
  });
});

describe('fotos', () => {
  const upload = (api: ReturnType<typeof setup>, homeId: string) =>
    api.createPhotoUpload(homeId, 'image/jpeg');

  it('pide la URL firmada con el tipo de contenido (POST /homes/{id}/photos)', async () => {
    const home = draftHome();
    const backend = new FakeBackend({ homes: [home] });

    const target = await upload(setup(backend), home.id);

    expect(target.uploadUrl).toContain('storage.changehouse.test');
    expect(backend.requestsTo('POST', `/homes/${home.id}/photos`)).toMatchObject([
      { body: { contentType: 'image/jpeg' } },
    ]);
  });

  it('confirma la subida y devuelve la foto procesada', async () => {
    const home = draftHome();
    const backend = new FakeBackend({ homes: [home] });
    const api = setup(backend);
    const target = await upload(api, home.id);
    backend.homes.receiveUpload(target.uploadUrl, true);

    const photo = await api.completePhotoUpload(home.id, target.photoId);

    expect(photo).toMatchObject({ id: target.photoId, position: 1 });
    expect(backend.homes.all()[0]?.photos).toHaveLength(1);
  });

  it('elimina una foto (DELETE /homes/{id}/photos/{photoId})', async () => {
    const home = completeHome();
    const backend = new FakeBackend({ homes: [home] });
    const photoId = home.photos?.[0]?.id ?? '';

    await setup(backend).deletePhoto(home.id, photoId);

    expect(backend.requestsTo('DELETE', `/homes/${home.id}/photos/${photoId}`)).toHaveLength(1);
    expect(backend.homes.all()[0]?.photos).toHaveLength(2);
  });

  it('pedir otra URL con 20 fotos es photo-limit (409 PHOTO_LIMIT_REACHED)', async () => {
    const home = draftHome({ photos: readyPhotos(20) });
    const backend = new FakeBackend({ homes: [home] });

    expect(await failureOf(setup(backend).createPhotoUpload(home.id, 'image/png'))).toMatchObject({
      kind: 'photo-limit',
    });
  });

  it('Scenario: Demasiadas fotos pendientes - con 25 pendientes es too-many-pending (409 TOO_MANY_PENDING_PHOTOS)', async () => {
    const home = draftHome();
    const backend = new FakeBackend({ homes: [home] });
    backend.homes.seedPending(home.id, 25);

    expect(await failureOf(setup(backend).createPhotoUpload(home.id, 'image/png'))).toMatchObject({
      kind: 'too-many-pending',
    });
  });

  it('confirmar con el procesado saturado es busy (503 IMAGE_PROCESSING_BUSY)', async () => {
    const home = draftHome();
    const backend = new FakeBackend({ homes: [home] });
    const api = setup(backend);
    const target = await upload(api, home.id);
    backend.homes.receiveUpload(target.uploadUrl, true);
    backend.homes.busyCompletions = 1;

    expect(await failureOf(api.completePhotoUpload(home.id, target.photoId))).toMatchObject({
      kind: 'busy',
    });
  });

  it('un fichero que no es imagen es invalid-image (422 INVALID_IMAGE)', async () => {
    const home = draftHome();
    const backend = new FakeBackend({ homes: [home] });
    const api = setup(backend);
    const target = await upload(api, home.id);
    backend.homes.receiveUpload(target.uploadUrl, false);

    expect(await failureOf(api.completePhotoUpload(home.id, target.photoId))).toMatchObject({
      kind: 'invalid-image',
    });
  });

  it('confirmar sin haber subido es photo-not-uploaded (422 PHOTO_NOT_UPLOADED)', async () => {
    const home = draftHome();
    const api = setup(new FakeBackend({ homes: [home] }));
    const target = await upload(api, home.id);

    expect(await failureOf(api.completePhotoUpload(home.id, target.photoId))).toMatchObject({
      kind: 'photo-not-uploaded',
    });
  });

  it('borrar por debajo del mínimo en una publicada es min-photos (409 HOME_MIN_PHOTOS)', async () => {
    const home = completeHome({ status: 'published' });
    const api = setup(new FakeBackend({ homes: [home] }));

    expect(await failureOf(api.deletePhoto(home.id, home.photos?.[0]?.id ?? ''))).toMatchObject({
      kind: 'min-photos',
    });
  });

  it('otro 409 sigue siendo conflict y un 404, not-found', async () => {
    const home = draftHome({ status: 'closed' });
    const api = setup(new FakeBackend({ homes: [home] }));

    expect(await failureOf(api.createPhotoUpload(home.id, 'image/png'))).toMatchObject({
      kind: 'conflict',
    });
    expect(await failureOf(api.deletePhoto(home.id, 'no-existe'))).toMatchObject({
      kind: 'conflict',
    });
    expect(await failureOf(api.completePhotoUpload('no-existe', 'x'))).toMatchObject({
      kind: 'not-found',
    });
  });

  it('un fallo de red al pedir la URL es network', async () => {
    const home = draftHome();
    const backend = new FakeBackend({ homes: [home] });
    backend.failNext = 'network';

    expect(await failureOf(setup(backend).createPhotoUpload(home.id, 'image/png'))).toMatchObject({
      kind: 'network',
    });
  });

  it('enviar con menos de 3 fotos señala photos entre los campos que faltan', async () => {
    const home = completeHome({ photos: readyPhotos(2) });

    expect(
      await failureOf(setup(new FakeBackend({ homes: [home] })).submit(home.id)),
    ).toMatchObject({ kind: 'incomplete', fields: ['photos'] });
  });
});
