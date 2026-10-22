import { FIXTURE_PLACES } from '@changehouse/shared';
import { describe, expect, it } from 'vitest';

import {
  CatalogPlaceResolver,
  InMemoryHomeRepository,
  InMemoryPhotoRepository,
  InMemoryPhotoStorage,
} from '../../../test/fakes.js';
import { HomeIncompleteError, HomeNotEditableError } from '../../domain/home/errors.js';
import type { Home, HomeLocation } from '../../domain/home/home.js';
import type { HomePhoto } from '../../domain/home/photo.js';
import { AddressNotResolvedError, HomeNotFoundError } from './errors.js';
import { homeOperations } from './home-operations.js';

const NOW = new Date('2026-10-19T10:00:00.000Z');
const MALASANA = FIXTURE_PLACES[0]!;
const CHAMBERI = FIXTURE_PLACES[1]!;
const ADDRESS = { placeId: MALASANA.placeId, formatted: MALASANA.formatted };
const COMPLETE = {
  usefulM2: 80,
  builtM2: 95,
  bedrooms: 3,
  bathrooms: 2,
  hasLift: true,
  garage: false,
  storageRoom: false,
  valueMinCents: 250_000_00,
  valueMaxCents: 280_000_00,
  isPrimaryResidence: true,
};

function setup() {
  const homes = new InMemoryHomeRepository();
  const photos = new InMemoryPhotoRepository();
  const storage = new InMemoryPhotoStorage();
  let sequence = 0;
  const resolved: string[] = [];
  const places = new CatalogPlaceResolver();
  const operations = homeOperations({
    homes,
    photos,
    storage,
    places: {
      resolve: (placeId: string): Promise<HomeLocation | null> => {
        resolved.push(placeId);
        return places.resolve(placeId);
      },
    },
    clock: { now: () => NOW },
    ids: { next: () => `home-${String(++sequence)}` },
  });
  return { homes, photos, resolved, ...operations };
}

/** Fotos de la vivienda: `ready` con su posición, o `pending` sin ella. */
const addPhotos = (
  photos: InMemoryPhotoRepository,
  homeId: string,
  count: number,
  status: HomePhoto['status'] = 'ready',
) => {
  for (let index = 1; index <= count; index += 1) {
    const id = `${status}-${homeId}-${String(index)}`;
    photos.photos.set(id, {
      id,
      homeId,
      status,
      storagePath: `homes/${homeId}/${id}.webp`,
      position: status === 'ready' ? index : null,
      createdAt: NOW,
    });
  }
};

const publish = (homes: InMemoryHomeRepository, id: string, changes: Partial<Home> = {}) => {
  const home = homes.homes.get(id);
  if (!home) throw new Error(`Vivienda inexistente: ${id}`);
  homes.homes.set(id, { ...home, status: 'published', ...changes });
};

describe('createHome', () => {
  it('Scenario: Alta de vivienda en borrador - nace en draft, resuelve la dirección en el servidor y devuelve la ficha completa', async () => {
    const { createHome, homes, resolved } = setup();

    const view = await createHome('user-1', { type: 'piso', address: ADDRESS });

    expect(resolved).toEqual([MALASANA.placeId]);
    expect(view).toMatchObject({
      id: 'home-1',
      status: 'draft',
      type: 'piso',
      regime: 'libre',
      address: MALASANA.formatted,
      isPrimaryResidence: null,
      usefulM2: null,
      location: { visibility: 'area', point: MALASANA.areaCenter, areaName: 'Malasaña' },
      photos: [],
      createdAt: NOW.toISOString(),
    });
    expect(homes.homes.get('home-1')).toMatchObject({ ownerId: 'user-1', status: 'draft' });
  });

  it('guarda los datos del primer paso si vienen con la dirección', async () => {
    const { createHome } = setup();

    const view = await createHome('user-1', {
      type: 'atico',
      address: ADDRESS,
      ...COMPLETE,
      locationVisibility: 'exact',
    });

    expect(view).toMatchObject({ ...COMPLETE, type: 'atico' });
    expect(view.location).toMatchObject({ visibility: 'exact', point: MALASANA.exact });
  });

  it('Scenario: Dirección no reconocida - no guarda nada y señala el campo address', async () => {
    const { createHome, homes } = setup();

    const attempt = createHome('user-1', {
      type: 'piso',
      address: { placeId: 'fixture-desconocido', formatted: 'Calle Inventada, 1' },
    });

    await expect(attempt).rejects.toBeInstanceOf(AddressNotResolvedError);
    await expect(attempt).rejects.toMatchObject({ fields: ['address'] });
    expect(homes.homes.size).toBe(0);
  });

  it('Scenario: Rango de valor incoherente - rechaza el mínimo mayor que el máximo y no guarda', async () => {
    const { createHome, homes } = setup();

    await expect(
      createHome('user-1', {
        type: 'piso',
        address: ADDRESS,
        valueMinCents: 300,
        valueMaxCents: 200,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_VALUE_RANGE' });
    expect(homes.homes.size).toBe(0);
  });
});

describe('updateHome', () => {
  it('Scenario: Asistente que guarda el avance - cada paso se guarda sobre el mismo borrador', async () => {
    const { createHome, updateHome, homes } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS });

    const view = await updateHome('user-1', 'home-1', { bedrooms: 2, features: { terrace: true } });

    expect(view).toMatchObject({ id: 'home-1', bedrooms: 2, features: { terrace: true } });
    expect(homes.homes.get('home-1')).toMatchObject({ bedrooms: 2, status: 'draft' });
  });

  it('cambiar la dirección la vuelve a resolver y sustituye la ubicación', async () => {
    const { createHome, updateHome, resolved } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS });

    const view = await updateHome('user-1', 'home-1', {
      address: { placeId: CHAMBERI.placeId, formatted: CHAMBERI.formatted },
    });

    expect(resolved).toEqual([MALASANA.placeId, CHAMBERI.placeId]);
    expect(view).toMatchObject({
      address: CHAMBERI.formatted,
      location: { areaName: 'Chamberí', point: CHAMBERI.areaCenter },
    });
  });

  it('si el cambio no trae dirección no llama al servicio de direcciones', async () => {
    const { createHome, updateHome, resolved } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS });

    await updateHome('user-1', 'home-1', { bathrooms: 1 });

    expect(resolved).toEqual([MALASANA.placeId]);
  });

  it('una dirección no reconocida deja la vivienda como estaba', async () => {
    const { createHome, updateHome, homes } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS });

    await expect(
      updateHome('user-1', 'home-1', { address: { placeId: 'x', formatted: 'Nada' } }),
    ).rejects.toBeInstanceOf(AddressNotResolvedError);
    expect(homes.homes.get('home-1')?.address).toBe(MALASANA.formatted);
  });

  it('Scenario: Vivienda ajena no publicada - modificar la de otro es un 404 y no cambia nada', async () => {
    const { createHome, updateHome, homes } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS });

    await expect(updateHome('user-2', 'home-1', { bedrooms: 9 })).rejects.toBeInstanceOf(
      HomeNotFoundError,
    );
    await expect(updateHome('user-2', 'no-existe', { bedrooms: 9 })).rejects.toBeInstanceOf(
      HomeNotFoundError,
    );
    expect(homes.homes.get('home-1')?.bedrooms).toBeNull();
  });

  it('Scenario: Edición de una vivienda en operación - el dominio lo rechaza y no se guarda', async () => {
    const { createHome, updateHome, homes } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS });
    publish(homes, 'home-1', { status: 'in_operation' });

    await expect(updateHome('user-1', 'home-1', { bedrooms: 9 })).rejects.toBeInstanceOf(
      HomeNotEditableError,
    );
    expect(homes.homes.get('home-1')?.bedrooms).toBeNull();
  });

  it('una vivienda publicada que cambia un dato relevante vuelve a in_review', async () => {
    const { createHome, updateHome, homes } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS, ...COMPLETE });
    publish(homes, 'home-1');

    const view = await updateHome('user-1', 'home-1', { usefulM2: 90 });

    expect(view.status).toBe('in_review');
  });
});

describe('listMyHomes', () => {
  it('Scenario: Segunda vivienda - lista todas las del usuario con su estado y ninguna ajena', async () => {
    const { createHome, listMyHomes, homes } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS });
    publish(homes, 'home-1');
    await createHome('user-1', { type: 'casa', address: ADDRESS });
    await createHome('user-2', { type: 'estudio', address: ADDRESS });

    const views = await listMyHomes('user-1');

    expect(views.map((view) => [view.id, view.status])).toEqual([
      ['home-1', 'published'],
      ['home-2', 'draft'],
    ]);
  });

  it('sin viviendas devuelve una lista vacía', async () => {
    const { listMyHomes } = setup();

    expect(await listMyHomes('user-1')).toEqual([]);
  });
});

describe('getHome', () => {
  it('Scenario: El propietario ve su borrador - ficha completa con la dirección', async () => {
    const { createHome, getHome } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS });

    const view = await getHome('user-1', 'home-1');

    expect(view).toMatchObject({ status: 'draft', address: MALASANA.formatted });
  });

  it('Scenario: Ubicación por zona por defecto - otro usuario ve el barrio y su centro, nunca el punto exacto ni la dirección', async () => {
    const { createHome, getHome, homes } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS, ...COMPLETE });
    publish(homes, 'home-1');

    const view = await getHome('user-2', 'home-1');

    expect(view).toMatchObject({
      location: { visibility: 'area', point: MALASANA.areaCenter, areaName: 'Malasaña' },
    });
    expect(JSON.stringify(view)).not.toContain(String(MALASANA.exact.lat));
    expect(view).not.toHaveProperty('address');
    expect(view).not.toHaveProperty('status');
    expect(view).not.toHaveProperty('ownerId');
  });

  it('Scenario: Ubicación exacta elegida - otro usuario ve el punto exacto pero no la dirección', async () => {
    const { createHome, getHome, homes } = setup();
    await createHome('user-1', {
      type: 'piso',
      address: ADDRESS,
      ...COMPLETE,
      locationVisibility: 'exact',
    });
    publish(homes, 'home-1');

    const view = await getHome('user-2', 'home-1');

    expect(view).toMatchObject({
      location: { visibility: 'exact', point: MALASANA.exact, areaName: 'Malasaña' },
    });
    expect(view).not.toHaveProperty('address');
    expect(JSON.stringify(view)).not.toContain('Calle del Pez');
  });

  it.each(['draft', 'in_review', 'paused', 'in_operation', 'closed'] as const)(
    'Scenario: Vivienda ajena no publicada - en %s es un 404 igual que si no existiera',
    async (status) => {
      const { createHome, getHome, homes } = setup();
      await createHome('user-1', { type: 'piso', address: ADDRESS });
      publish(homes, 'home-1', { status });

      const foreign = await getHome('user-2', 'home-1').catch((error: unknown) => error);
      const missing = await getHome('user-2', 'no-existe').catch((error: unknown) => error);

      expect(foreign).toBeInstanceOf(HomeNotFoundError);
      expect(foreign).toEqual(missing);
    },
  );

  it('el propietario ve su vivienda en cualquier estado', async () => {
    const { createHome, getHome, homes } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS });
    publish(homes, 'home-1', { status: 'closed' });

    expect(await getHome('user-1', 'home-1')).toMatchObject({ status: 'closed' });
  });
});

describe('submitHome', () => {
  it('Scenario: Envío de una ficha completa - pasa a in_review', async () => {
    const { createHome, submitHome, homes, photos } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS, ...COMPLETE });
    addPhotos(photos, 'home-1', 3);

    const view = await submitHome('user-1', 'home-1');

    expect(view.status).toBe('in_review');
    expect(homes.homes.get('home-1')?.status).toBe('in_review');
  });

  it('Scenario: Ver la cola - al enviar se guarda la fecha de envío con la que se ordena la cola', async () => {
    const { createHome, submitHome, homes, photos } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS, ...COMPLETE });
    addPhotos(photos, 'home-1', 3);

    await submitHome('user-1', 'home-1');

    expect(homes.homes.get('home-1')?.submittedAt).toEqual(NOW);
  });

  it('Scenario: Envío de una ficha incompleta - falla señalando los campos y sigue en draft', async () => {
    const { createHome, submitHome, homes, photos } = setup();
    await createHome('user-1', {
      type: 'piso',
      address: ADDRESS,
      ...COMPLETE,
      valueMinCents: undefined,
      valueMaxCents: undefined,
    });
    addPhotos(photos, 'home-1', 3);

    await expect(submitHome('user-1', 'home-1')).rejects.toBeInstanceOf(HomeIncompleteError);
    await expect(submitHome('user-1', 'home-1')).rejects.toMatchObject({
      fields: ['valueMinCents', 'valueMaxCents'],
    });
    expect(homes.homes.get('home-1')?.status).toBe('draft');
  });

  it('Scenario: Envío con menos de 3 fotos - con 2 fotos listas falla señalando photos y sigue en draft; las pendientes no cuentan', async () => {
    const { createHome, submitHome, homes, photos } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS, ...COMPLETE });
    addPhotos(photos, 'home-1', 2);
    addPhotos(photos, 'home-1', 5, 'pending');

    await expect(submitHome('user-1', 'home-1')).rejects.toBeInstanceOf(HomeIncompleteError);
    await expect(submitHome('user-1', 'home-1')).rejects.toMatchObject({ fields: ['photos'] });
    expect(homes.homes.get('home-1')?.status).toBe('draft');
  });

  it('enviar la vivienda de otro es un 404', async () => {
    const { createHome, submitHome } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS, ...COMPLETE });

    await expect(submitHome('user-2', 'home-1')).rejects.toBeInstanceOf(HomeNotFoundError);
  });
});

describe('fotos en la ficha', () => {
  it('Scenario: Subida sin confirmar - el propietario solo ve las fotos listas, por posición, con su URL pública', async () => {
    const { createHome, getHome, photos } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS });
    addPhotos(photos, 'home-1', 2);
    addPhotos(photos, 'home-1', 1, 'pending');

    const view = await getHome('user-1', 'home-1');

    expect(view.photos).toEqual([
      {
        id: 'ready-home-1-1',
        url: 'https://cdn.test/homes/home-1/ready-home-1-1.webp',
        position: 1,
      },
      {
        id: 'ready-home-1-2',
        url: 'https://cdn.test/homes/home-1/ready-home-1-2.webp',
        position: 2,
      },
    ]);
  });

  it('Scenario: Subida sin confirmar - cualquier usuario ve una vivienda publicada sin sus fotos pendientes', async () => {
    const { createHome, getHome, photos, homes } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS, ...COMPLETE });
    publish(homes, 'home-1');
    addPhotos(photos, 'home-1', 3);
    addPhotos(photos, 'home-1', 4, 'pending');

    const view = await getHome('user-2', 'home-1');

    expect(view.photos.map((photo) => photo.id)).toEqual([
      'ready-home-1-1',
      'ready-home-1-2',
      'ready-home-1-3',
    ]);
  });

  it('«Mis casas» trae las fotos de cada vivienda y no mezcla las de una con las de otra', async () => {
    const { createHome, listMyHomes, photos } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS });
    await createHome('user-1', { type: 'casa', address: ADDRESS });
    addPhotos(photos, 'home-1', 3);
    addPhotos(photos, 'home-2', 1);

    const views = await listMyHomes('user-1');

    expect(views.map((view) => view.photos.length)).toEqual([3, 1]);
    expect(views[1]?.photos[0]?.id).toBe('ready-home-2-1');
  });

  it('actualizar la ficha conserva sus fotos en la respuesta', async () => {
    const { createHome, updateHome, photos } = setup();
    await createHome('user-1', { type: 'piso', address: ADDRESS });
    addPhotos(photos, 'home-1', 3);

    const view = await updateHome('user-1', 'home-1', { bedrooms: 2 });

    expect(view.photos).toHaveLength(3);
  });
});
