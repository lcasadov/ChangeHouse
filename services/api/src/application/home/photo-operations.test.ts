import { describe, expect, it } from 'vitest';

import {
  InMemoryHomeRepository,
  InMemoryPhotoRepository,
  InMemoryPhotoStorage,
  StubImageProcessor,
} from '../../../test/fakes.js';
import {
  HomeMinPhotosError,
  HomeNotEditableError,
  InvalidImageError,
  PhotoLimitReachedError,
  PhotoNotUploadedError,
  TooManyPendingPhotosError,
} from '../../domain/home/errors.js';
import { type Home, newDraft } from '../../domain/home/home.js';
import type { HomePhoto } from '../../domain/home/photo.js';
import { HomeNotFoundError, PhotoNotFoundError } from './errors.js';
import { MAX_ORIGINAL_BYTES, photoOperations } from './photo-operations.js';

const NOW = new Date('2026-10-19T10:00:00.000Z');
const OWNER = 'user-1';
const HOME = 'home-1';
const OTHER_HOME = 'home-2';
const LOCATION = {
  exact: { lat: 40.4254, lng: -3.7058 },
  areaName: 'Malasaña',
  areaCenter: { lat: 40.4265, lng: -3.7038 },
};
const FIFTEEN_MINUTES = 15 * 60 * 1000;

function homeOf(id: string, ownerId: string, status: Home['status'] = 'draft'): Home {
  const draft = newDraft({
    id,
    ownerId,
    now: NOW,
    type: 'piso',
    address: 'Calle del Pez, 12',
    location: LOCATION,
  });
  return { ...draft, status };
}

function setup(status: Home['status'] = 'draft') {
  const homes = new InMemoryHomeRepository();
  homes.homes.set(HOME, homeOf(HOME, OWNER, status));
  homes.homes.set(OTHER_HOME, homeOf(OTHER_HOME, 'user-2'));
  const photos = new InMemoryPhotoRepository();
  const storage = new InMemoryPhotoStorage();
  const images = new StubImageProcessor();
  let sequence = 0;
  const operations = photoOperations({
    homes,
    photos,
    storage,
    images,
    clock: { now: () => NOW },
    ids: { next: () => `photo-${String(++sequence)}` },
  });
  return { homes, photos, storage, images, ...operations };
}

type Setup = ReturnType<typeof setup>;

/** Una foto ya procesada y publicada en la posición indicada. */
function seedReady(env: Setup, position: number, homeId = HOME): HomePhoto {
  const photo: HomePhoto = {
    id: `ready-${homeId}-${String(position)}`,
    homeId,
    status: 'ready',
    storagePath: `homes/${homeId}/ready-${String(position)}.webp`,
    position,
    createdAt: NOW,
  };
  env.photos.photos.set(photo.id, photo);
  env.storage.published.set(photo.storagePath, {
    data: Buffer.from('WEBP'),
    contentType: 'image/webp',
  });
  return photo;
}

function seedMany(env: Setup, count: number, homeId = HOME): void {
  for (let position = 1; position <= count; position += 1) seedReady(env, position, homeId);
}

/** Emite la URL y simula que el cliente subió el contenido indicado a la ruta firmada. */
async function uploaded(env: Setup, content: string | Buffer, homeId = HOME): Promise<string> {
  const { photoId } = await env.createPhotoUpload(OWNER, homeId, 'image/jpeg');
  env.storage.originals.set(`originals/${homeId}/${photoId}`, Buffer.from(content));
  return photoId;
}

describe('createPhotoUpload: fotos pendientes', () => {
  /** Fotos pending (URL emitida y sin confirmar) de esa vivienda. */
  function seedPending(env: Setup, count: number, homeId = HOME): void {
    for (let index = 0; index < count; index += 1) {
      const id = `pending-${homeId}-${String(index)}`;
      env.photos.photos.set(id, {
        id,
        homeId,
        status: 'pending',
        storagePath: `homes/${homeId}/${id}.webp`,
        position: null,
        createdAt: NOW,
      });
    }
  }

  it('Scenario: Demasiadas fotos pendientes - con 25 pendientes responde TooManyPendingPhotosError (409) y no crea la foto ni la URL', async () => {
    const env = setup();
    seedPending(env, 25);

    const attempt = env.createPhotoUpload(OWNER, HOME, 'image/jpeg');

    await expect(attempt).rejects.toBeInstanceOf(TooManyPendingPhotosError);
    await expect(attempt).rejects.toMatchObject({
      code: 'TOO_MANY_PENDING_PHOTOS',
      kind: 'conflict',
    });
    expect(env.photos.photos.size).toBe(25);
    expect(env.storage.uploadUrls).toEqual([]);
  });

  it('con 24 pendientes todavía admite una más', async () => {
    const env = setup();
    seedPending(env, 24);

    await expect(env.createPhotoUpload(OWNER, HOME, 'image/jpeg')).resolves.toMatchObject({
      photoId: 'photo-1',
    });
  });

  it('solo cuentan las pendientes de esa vivienda: ni las ya procesadas ni las de otra', async () => {
    const env = setup();
    seedPending(env, 25, OTHER_HOME);
    seedMany(env, 10);

    await expect(env.createPhotoUpload(OWNER, HOME, 'image/jpeg')).resolves.toBeDefined();
  });

  it('confirmar una pendiente libera cupo', async () => {
    const env = setup();
    seedPending(env, 24);
    const photoId = await uploaded(env, 'IMG:foto');
    await expect(env.createPhotoUpload(OWNER, HOME, 'image/jpeg')).rejects.toBeInstanceOf(
      TooManyPendingPhotosError,
    );

    await env.completePhotoUpload(OWNER, HOME, photoId);

    await expect(env.createPhotoUpload(OWNER, HOME, 'image/jpeg')).resolves.toBeDefined();
  });
});

describe('createPhotoUpload', () => {
  it('Scenario: Subir una foto - emite una URL firmada de 15 minutos con el tipo de contenido fijado y crea la foto pending', async () => {
    const env = setup();

    const upload = await env.createPhotoUpload(OWNER, HOME, 'image/heic');

    expect(upload).toEqual({
      photoId: 'photo-1',
      uploadUrl: 'https://storage.test/upload/originals/home-1/photo-1',
      expiresAt: new Date(NOW.getTime() + FIFTEEN_MINUTES).toISOString(),
    });
    expect(env.storage.uploadUrls).toEqual([
      {
        path: 'originals/home-1/photo-1',
        contentType: 'image/heic',
        expiresAt: new Date(NOW.getTime() + FIFTEEN_MINUTES),
      },
    ]);
    expect(env.photos.photos.get('photo-1')).toMatchObject({
      homeId: HOME,
      status: 'pending',
      position: null,
      storagePath: 'homes/home-1/photo-1.webp',
    });
  });

  it('Scenario: Límite de 20 fotos - con 20 fotos listas lanza PhotoLimitReachedError y no emite ninguna URL', async () => {
    const env = setup();
    seedMany(env, 20);

    await expect(env.createPhotoUpload(OWNER, HOME, 'image/jpeg')).rejects.toBeInstanceOf(
      PhotoLimitReachedError,
    );
    expect(env.storage.uploadUrls).toEqual([]);
    expect(env.photos.photos.size).toBe(20);
  });

  it('con 19 fotos listas todavía se puede pedir una URL, y las pendientes no cuentan para el límite', async () => {
    const env = setup();
    seedMany(env, 19);
    for (let index = 0; index < 3; index += 1) {
      await env.createPhotoUpload(OWNER, HOME, 'image/png');
    }

    expect(env.storage.uploadUrls).toHaveLength(3);
  });

  it('Scenario: Vivienda ajena no publicada - pedir una URL para la vivienda de otro es un 404 y no emite nada', async () => {
    const env = setup();

    await expect(env.createPhotoUpload(OWNER, OTHER_HOME, 'image/jpeg')).rejects.toBeInstanceOf(
      HomeNotFoundError,
    );
    await expect(env.createPhotoUpload(OWNER, 'no-existe', 'image/jpeg')).rejects.toBeInstanceOf(
      HomeNotFoundError,
    );
    expect(env.storage.uploadUrls).toEqual([]);
  });

  it.each(['in_operation', 'closed'] as const)(
    'Scenario: Edición de una vivienda en operación - en %s no admite fotos nuevas',
    async (status) => {
      const env = setup(status);

      await expect(env.createPhotoUpload(OWNER, HOME, 'image/jpeg')).rejects.toBeInstanceOf(
        HomeNotEditableError,
      );
      expect(env.photos.photos.size).toBe(0);
    },
  );
});

describe('completePhotoUpload', () => {
  it('Scenario: Subir una foto - procesa el original, publica la versión pública, borra el original y la deja ready en la posición 1', async () => {
    const env = setup();
    const photoId = await uploaded(env, 'IMG:original-con-gps');

    const view = await env.completePhotoUpload(OWNER, HOME, photoId);

    expect(view).toEqual({
      id: photoId,
      url: `https://cdn.test/homes/home-1/${photoId}.webp`,
      position: 1,
    });
    expect(env.photos.photos.get(photoId)).toMatchObject({ status: 'ready', position: 1 });
    expect(env.storage.published.get(`homes/home-1/${photoId}.webp`)).toEqual({
      data: Buffer.from('WEBP:IMG:original-con-gps'),
      contentType: 'image/webp',
    });
    expect(env.storage.originals.size).toBe(0);
  });

  it('Scenario: Foto con coordenadas GPS - lo que se publica es la salida del procesador, nunca el original', async () => {
    const env = setup();
    const photoId = await uploaded(env, 'IMG:con-gps');

    await env.completePhotoUpload(OWNER, HOME, photoId);

    expect(env.images.received).toEqual([Buffer.from('IMG:con-gps')]);
    const published = [...env.storage.published.values()].map((object) => object.data.toString());
    expect(published).toEqual(['WEBP:IMG:con-gps']);
  });

  it('las fotos van tomando la primera posición libre', async () => {
    const env = setup();
    seedReady(env, 1);
    seedReady(env, 3);
    const photoId = await uploaded(env, 'IMG:x');

    const view = await env.completePhotoUpload(OWNER, HOME, photoId);

    expect(view.position).toBe(2);
  });

  it('Scenario: Fichero que no es una imagen - lanza InvalidImageError, elimina el fichero y descarta la foto', async () => {
    const env = setup();
    const photoId = await uploaded(env, 'esto no es una imagen');

    await expect(env.completePhotoUpload(OWNER, HOME, photoId)).rejects.toBeInstanceOf(
      InvalidImageError,
    );

    expect(env.storage.originals.size).toBe(0);
    expect(env.storage.published.size).toBe(0);
    expect(env.photos.photos.has(photoId)).toBe(false);
  });

  it('un original por encima del tamaño máximo se descarta sin procesarlo', async () => {
    const env = setup();
    const photoId = await uploaded(env, Buffer.alloc(MAX_ORIGINAL_BYTES + 1));

    await expect(env.completePhotoUpload(OWNER, HOME, photoId)).rejects.toBeInstanceOf(
      InvalidImageError,
    );

    expect(env.images.received).toEqual([]);
    expect(env.storage.originals.size).toBe(0);
    expect(env.photos.photos.has(photoId)).toBe(false);
  });

  it('Scenario: Subida sin confirmar - si el fichero aún no se ha subido responde PhotoNotUploadedError y la foto sigue pending', async () => {
    const env = setup();
    const { photoId } = await env.createPhotoUpload(OWNER, HOME, 'image/jpeg');

    await expect(env.completePhotoUpload(OWNER, HOME, photoId)).rejects.toBeInstanceOf(
      PhotoNotUploadedError,
    );

    expect(env.photos.photos.get(photoId)?.status).toBe('pending');
    expect(env.storage.published.size).toBe(0);
  });

  it('Scenario: Límite de 20 fotos - si al confirmar ya hay 20 listas lanza PhotoLimitReachedError y descarta la foto y sus ficheros', async () => {
    const env = setup();
    const photoId = await uploaded(env, 'IMG:vigesimoprimera');
    seedMany(env, 20);

    await expect(env.completePhotoUpload(OWNER, HOME, photoId)).rejects.toBeInstanceOf(
      PhotoLimitReachedError,
    );

    expect(env.photos.photos.has(photoId)).toBe(false);
    expect(env.storage.originals.size).toBe(0);
    expect(env.storage.published.has(`homes/home-1/${photoId}.webp`)).toBe(false);
    expect(env.storage.published.size).toBe(20);
  });

  it('confirmar dos veces una foto ya lista devuelve la misma foto sin procesarla otra vez', async () => {
    const env = setup();
    const photoId = await uploaded(env, 'IMG:x');
    const first = await env.completePhotoUpload(OWNER, HOME, photoId);

    const second = await env.completePhotoUpload(OWNER, HOME, photoId);

    expect(second).toEqual(first);
    expect(env.images.received).toHaveLength(1);
  });

  it('una foto que no existe o es de otra vivienda es un 404', async () => {
    const env = setup();
    const foreign = await uploaded(env, 'IMG:x', HOME);

    await expect(env.completePhotoUpload(OWNER, HOME, 'no-existe')).rejects.toBeInstanceOf(
      PhotoNotFoundError,
    );
    await expect(env.completePhotoUpload('user-2', OTHER_HOME, foreign)).rejects.toBeInstanceOf(
      PhotoNotFoundError,
    );
  });

  it('Scenario: Vivienda ajena no publicada - confirmar en la vivienda de otro es un 404 y no procesa nada', async () => {
    const env = setup();
    const photoId = await uploaded(env, 'IMG:x');

    await expect(env.completePhotoUpload('user-2', HOME, photoId)).rejects.toBeInstanceOf(
      HomeNotFoundError,
    );
    expect(env.images.received).toEqual([]);
  });
});

describe('deletePhoto', () => {
  it('Scenario: Borrar por debajo del mínimo en una vivienda publicada - con 3 fotos lanza HomeMinPhotosError y la foto se mantiene', async () => {
    const env = setup('published');
    seedMany(env, 3);

    await expect(env.deletePhoto(OWNER, HOME, 'ready-home-1-1')).rejects.toBeInstanceOf(
      HomeMinPhotosError,
    );

    expect(env.photos.photos.size).toBe(3);
    expect(env.storage.published.size).toBe(3);
  });

  it('con 4 fotos se puede borrar una de una vivienda publicada y se borran también sus ficheros', async () => {
    const env = setup('published');
    seedMany(env, 4);

    await env.deletePhoto(OWNER, HOME, 'ready-home-1-2');

    expect(env.photos.photos.has('ready-home-1-2')).toBe(false);
    expect(env.storage.published.has('homes/home-1/ready-2.webp')).toBe(false);
    expect(env.photos.photos.size).toBe(3);
  });

  it('un borrador puede borrar todas sus fotos', async () => {
    const env = setup('draft');
    seedMany(env, 3);

    for (const id of ['ready-home-1-1', 'ready-home-1-2', 'ready-home-1-3']) {
      await env.deletePhoto(OWNER, HOME, id);
    }

    expect(env.photos.photos.size).toBe(0);
  });

  it('borrar una foto pendiente elimina también el original subido y nunca baja del mínimo', async () => {
    const env = setup('published');
    seedMany(env, 3);
    const photoId = await uploaded(env, 'IMG:x');

    await env.deletePhoto(OWNER, HOME, photoId);

    expect(env.photos.photos.has(photoId)).toBe(false);
    expect(env.storage.originals.size).toBe(0);
    expect(env.photos.photos.size).toBe(3);
  });

  it('Scenario: Vivienda ajena no publicada - borrar en la vivienda de otro es un 404 y no cambia nada', async () => {
    const env = setup();
    seedMany(env, 4, OTHER_HOME);

    await expect(env.deletePhoto(OWNER, OTHER_HOME, 'ready-home-2-1')).rejects.toBeInstanceOf(
      HomeNotFoundError,
    );
    await expect(env.deletePhoto(OWNER, HOME, 'ready-home-2-1')).rejects.toBeInstanceOf(
      PhotoNotFoundError,
    );
    expect(env.photos.photos.size).toBe(4);
  });

  it.each(['in_operation', 'closed'] as const)(
    'Scenario: Edición de una vivienda en operación - en %s no se pueden borrar fotos',
    async (status) => {
      const env = setup(status);
      seedMany(env, 4);

      await expect(env.deletePhoto(OWNER, HOME, 'ready-home-1-1')).rejects.toBeInstanceOf(
        HomeNotEditableError,
      );
      expect(env.photos.photos.size).toBe(4);
    },
  );
});

describe('cambio relevante de las fotos (descarte, RF-44)', () => {
  it('Scenario: Descarte y cambio relevante - confirmar una foto de una vivienda publicada anota el cambio relevante', async () => {
    const env = setup('published');
    const photoId = await uploaded(env, 'IMG:nueva');

    await env.completePhotoUpload(OWNER, HOME, photoId);

    expect(env.homes.homes.get(HOME)?.relevantChangedAt).toEqual(NOW);
  });

  it('borrar una foto de una vivienda publicada anota el cambio relevante', async () => {
    const env = setup('published');
    seedMany(env, 4);

    await env.deletePhoto(OWNER, HOME, 'ready-home-1-4');

    expect(env.homes.homes.get(HOME)?.relevantChangedAt).toEqual(NOW);
  });

  it('en un borrador que nunca se publicó las fotos no son un cambio relevante', async () => {
    const env = setup('draft');
    const photoId = await uploaded(env, 'IMG:nueva');
    seedMany(env, 2);

    await env.completePhotoUpload(OWNER, HOME, photoId);
    await env.deletePhoto(OWNER, HOME, 'ready-home-1-1');

    expect(env.homes.homes.get(HOME)?.relevantChangedAt).toBeNull();
  });

  it('una foto que no llega a quedar lista no es un cambio relevante', async () => {
    const env = setup('published');
    const photoId = await uploaded(env, 'no es una imagen');

    await expect(env.completePhotoUpload(OWNER, HOME, photoId)).rejects.toBeInstanceOf(
      InvalidImageError,
    );

    expect(env.homes.homes.get(HOME)?.relevantChangedAt).toBeNull();
  });
});

describe('las fotos de una vivienda publicada o pausada la devuelven a revisión', () => {
  it.each(['published', 'paused'] as const)(
    'confirmar una foto nueva de una vivienda %s la deja in_review con su fecha de envío',
    async (status) => {
      const env = setup(status);
      const photoId = await uploaded(env, 'IMG:nueva');

      await env.completePhotoUpload(OWNER, HOME, photoId);

      expect(env.homes.homes.get(HOME)).toMatchObject({
        status: 'in_review',
        submittedAt: NOW,
        relevantChangedAt: NOW,
      });
    },
  );

  it.each(['published', 'paused'] as const)(
    'borrar una foto de una vivienda %s la deja in_review',
    async (status) => {
      const env = setup(status);
      seedMany(env, 4);

      await env.deletePhoto(OWNER, HOME, 'ready-home-1-4');

      expect(env.homes.homes.get(HOME)).toMatchObject({ status: 'in_review', submittedAt: NOW });
    },
  );

  it('una vivienda ya publicada que está en revisión solo anota el cambio y sigue en revisión', async () => {
    const env = setup('in_review');
    const home = env.homes.homes.get(HOME);
    if (home) env.homes.homes.set(HOME, { ...home, publishedAt: NOW, submittedAt: null });
    const photoId = await uploaded(env, 'IMG:nueva');

    await env.completePhotoUpload(OWNER, HOME, photoId);

    expect(env.homes.homes.get(HOME)).toMatchObject({
      status: 'in_review',
      submittedAt: null,
      relevantChangedAt: NOW,
    });
  });
});
