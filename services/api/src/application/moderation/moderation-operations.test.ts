import { describe, expect, it } from 'vitest';

import {
  InMemoryAuditLog,
  InMemoryHomeRepository,
  InMemoryPhotoRepository,
  InMemoryPhotoStorage,
  InMemoryUnitOfWork,
} from '../../../test/fakes.js';
import { HomeNotInReviewError } from '../../domain/home/errors.js';
import { type Home, newDraft } from '../../domain/home/home.js';
import { HomeNotFoundError } from '../home/errors.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import { moderationOperations } from './moderation-operations.js';

const NOW = new Date('2026-10-19T10:00:00.000Z');
const ADMIN = 'admin-1';
const LOCATION = {
  exact: { lat: 40.4254, lng: -3.7058 },
  areaName: 'Malasaña',
  areaCenter: { lat: 40.4265, lng: -3.7038 },
};

function setup() {
  const homes = new InMemoryHomeRepository();
  const photos = new InMemoryPhotoRepository();
  const audit = new InMemoryAuditLog();
  const operations = moderationOperations({
    units: new InMemoryUnitOfWork(homes, audit),
    homes,
    photos,
    storage: new InMemoryPhotoStorage(),
    clock: { now: () => NOW },
  });
  return { homes, photos, audit, ...operations };
}

type Fixture = ReturnType<typeof setup>;

/** Una vivienda ya guardada con el estado y las fechas que pide la prueba, y tres fotos listas. */
function seed(
  { homes, photos }: Pick<Fixture, 'homes' | 'photos'>,
  id: string,
  changes: Partial<Home> = {},
): Home {
  const draft = newDraft({
    id,
    ownerId: `owner-${id}`,
    now: new Date('2026-10-01T09:00:00.000Z'),
    type: 'piso',
    address: 'Calle del Pez, 12, 28004 Madrid',
    location: LOCATION,
  });
  const home: Home = { ...draft, status: 'in_review', ...changes };
  homes.homes.set(id, home);
  for (let position = 1; position <= 3; position += 1) {
    const photoId = `${id}-photo-${String(position)}`;
    photos.photos.set(photoId, {
      id: photoId,
      homeId: id,
      status: 'ready',
      storagePath: `homes/${id}/${photoId}.webp`,
      position,
      createdAt: NOW,
    });
  }
  return home;
}

const day = (n: number) => new Date(`2026-10-${String(n).padStart(2, '0')}T08:00:00.000Z`);

describe('adminListHomes', () => {
  it('Scenario: Ver la cola - la enviada antes va primero, con su ficha y sus fotos', async () => {
    const fixture = setup();
    seed(fixture, 'home-b', { submittedAt: day(12) });
    seed(fixture, 'home-a', { submittedAt: day(10) });
    seed(fixture, 'home-draft', { status: 'draft', submittedAt: null });

    const page = await fixture.adminListHomes({ status: 'in_review', limit: 20 });

    expect(page.items.map((item) => item.id)).toEqual(['home-a', 'home-b']);
    expect(page.nextCursor).toBeNull();
    expect(page.items[0]).toMatchObject({
      status: 'in_review',
      type: 'piso',
      photos: [
        {
          id: 'home-a-photo-1',
          url: 'https://cdn.test/homes/home-a/home-a-photo-1.webp',
          position: 1,
        },
        { id: 'home-a-photo-2', position: 2 },
        { id: 'home-a-photo-3', position: 3 },
      ],
    });
  });

  it('Scenario: Cola vacía - sin viviendas en revisión devuelve una página vacía sin cursor', async () => {
    const fixture = setup();
    seed(fixture, 'home-published', { status: 'published' });

    const page = await fixture.adminListHomes({ status: 'in_review', limit: 20 });

    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it('la vista de administración no lleva la dirección exacta: en su lugar va el barrio o zona', async () => {
    const fixture = setup();
    seed(fixture, 'home-a', { submittedAt: day(10) });

    const page = await fixture.adminListHomes({ status: 'in_review', limit: 20 });

    expect(page.items[0]?.address).toBe('Malasaña');
    expect(JSON.stringify(page)).not.toContain('Calle del Pez');
  });

  it('pagina por cursor sobre (envío, id): sin saltos ni repeticiones, también con el mismo instante', async () => {
    const fixture = setup();
    seed(fixture, 'home-1', { submittedAt: day(10) });
    seed(fixture, 'home-3', { submittedAt: day(11) });
    seed(fixture, 'home-2', { submittedAt: day(11) });
    seed(fixture, 'home-4', { submittedAt: day(12) });

    const first = await fixture.adminListHomes({ status: 'in_review', limit: 2 });
    const second = await fixture.adminListHomes({
      status: 'in_review',
      limit: 2,
      cursor: decodeCursor(first.nextCursor ?? '') ?? undefined,
    });

    expect(first.items.map((item) => item.id)).toEqual(['home-1', 'home-2']);
    expect(second.items.map((item) => item.id)).toEqual(['home-3', 'home-4']);
    expect(second.nextCursor).toBeNull();
  });

  it('sin estado devuelve todas las viviendas, de la más reciente a la más antigua', async () => {
    const fixture = setup();
    seed(fixture, 'home-old', { status: 'published', createdAt: day(1) });
    seed(fixture, 'home-new', { status: 'draft', createdAt: day(5) });
    seed(fixture, 'home-mid', { status: 'in_review', createdAt: day(3), submittedAt: day(4) });

    const page = await fixture.adminListHomes({ limit: 2 });
    const rest = await fixture.adminListHomes({
      limit: 2,
      cursor: decodeCursor(page.nextCursor ?? '') ?? undefined,
    });

    expect(page.items.map((item) => item.id)).toEqual(['home-new', 'home-mid']);
    expect(rest.items.map((item) => item.id)).toEqual(['home-old']);
  });
});

describe('cursor', () => {
  it('es opaco y se recupera tal cual', () => {
    const cursor = { at: day(10), id: 'home-1' };

    const encoded = encodeCursor(cursor);

    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it.each(['', 'no-es-un-cursor', 'e30', Buffer.from('{"at":"x","id":"y"}').toString('base64url')])(
    'un cursor mal formado (%j) se rechaza',
    (raw) => {
      expect(decodeCursor(raw)).toBeNull();
    },
  );
});

describe('adminModerateHome', () => {
  it('Scenario: Aprobar - pasa a published, limpia el motivo anterior y devuelve la ficha con fotos', async () => {
    const fixture = setup();
    seed(fixture, 'home-1', { moderationNote: 'Fotos borrosas' });

    const view = await fixture.adminModerateHome(ADMIN, 'home-1', { decision: 'approve' });

    expect(view).toMatchObject({ id: 'home-1', status: 'published', moderationNote: null });
    expect(view.photos).toHaveLength(3);
    expect(fixture.homes.homes.get('home-1')).toMatchObject({
      status: 'published',
      moderationNote: null,
    });
  });

  it('Scenario: Rechazar con motivo - vuelve a draft con el motivo visible para el propietario', async () => {
    const fixture = setup();
    seed(fixture, 'home-1');

    const view = await fixture.adminModerateHome(ADMIN, 'home-1', {
      decision: 'reject',
      reason: 'Las fotos no corresponden a la vivienda',
    });

    expect(view).toMatchObject({
      status: 'draft',
      moderationNote: 'Las fotos no corresponden a la vivienda',
    });
    expect(fixture.homes.homes.get('home-1')?.moderationNote).toBe(
      'Las fotos no corresponden a la vivienda',
    );
  });

  it('Scenario: Decisión auditada - queda una entrada con el admin, la acción, la vivienda y la fecha, sin el motivo', async () => {
    const fixture = setup();
    seed(fixture, 'home-1');

    await fixture.adminModerateHome(ADMIN, 'home-1', {
      decision: 'reject',
      reason: 'Datos falsos',
    });

    expect(fixture.audit.entries).toEqual([
      { actorId: ADMIN, action: 'home.reject', entity: 'home', entityId: 'home-1', at: NOW },
    ]);
  });

  it('aprobar se audita como home.approve', async () => {
    const fixture = setup();
    seed(fixture, 'home-1');

    await fixture.adminModerateHome(ADMIN, 'home-1', { decision: 'approve' });

    expect(fixture.audit.entries).toEqual([
      { actorId: ADMIN, action: 'home.approve', entity: 'home', entityId: 'home-1', at: NOW },
    ]);
  });

  it('Scenario: Sin auditoría no hay decisión - si falla la auditoría la vivienda sigue en in_review y el error se propaga', async () => {
    const fixture = setup();
    seed(fixture, 'home-1');
    fixture.audit.failWith = new Error('disco lleno');

    await expect(
      fixture.adminModerateHome(ADMIN, 'home-1', { decision: 'approve' }),
    ).rejects.toThrow('disco lleno');

    expect(fixture.homes.homes.get('home-1')?.status).toBe('in_review');
    expect(fixture.audit.entries).toEqual([]);
  });

  it('Scenario: Moderar algo que no está en revisión - una vivienda en draft da conflicto y no se audita', async () => {
    const fixture = setup();
    seed(fixture, 'home-1', { status: 'draft' });

    await expect(
      fixture.adminModerateHome(ADMIN, 'home-1', { decision: 'approve' }),
    ).rejects.toBeInstanceOf(HomeNotInReviewError);
    await expect(
      fixture.adminModerateHome(ADMIN, 'home-1', { decision: 'reject', reason: 'x' }),
    ).rejects.toBeInstanceOf(HomeNotInReviewError);

    expect(fixture.homes.homes.get('home-1')?.status).toBe('draft');
    expect(fixture.audit.entries).toEqual([]);
  });

  it('una vivienda inexistente es un 404', async () => {
    const fixture = setup();

    await expect(
      fixture.adminModerateHome(ADMIN, 'no-existe', { decision: 'approve' }),
    ).rejects.toBeInstanceOf(HomeNotFoundError);
    expect(fixture.audit.entries).toEqual([]);
  });
});
