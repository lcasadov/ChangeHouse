import { describe, expect, it } from 'vitest';

import {
  InMemoryAccountDeletion,
  InMemoryAuditLog,
  InMemoryHomeRepository,
  InMemoryMatchReader,
  InMemoryMatchUnitOfWork,
  InMemoryOutbox,
  InMemoryUserRepository,
  makeUser,
} from '../../../test/fakes.js';
import { HomeInOperationError } from '../../domain/home/errors.js';
import { type Home, newDraft } from '../../domain/home/home.js';
import type { ParticipantStatus } from '../../domain/matching/match.js';
import type { MatchRecord } from '../matching/matching-repository.js';
import { USER_DELETED } from '../outbox/outbox.js';
import { deleteAccount } from './account-deletion.js';

const NOW = new Date('2026-10-30T10:00:00.000Z');
const ME = 'user-me';

function homeOf(id: string, ownerId: string, status: Home['status'] = 'published'): Home {
  return {
    ...newDraft({
      id,
      ownerId,
      now: NOW,
      type: 'piso',
      address: 'Calle Mayor, 1, Getafe',
      location: {
        exact: { lat: 40.3, lng: -3.7 },
        areaName: 'Getafe Centro',
        areaCenter: { lat: 40.31, lng: -3.71 },
      },
      details: {},
    }),
    status,
  };
}

function match(
  id: string,
  status: MatchRecord['status'],
  mine: ParticipantStatus = 'pending',
): MatchRecord {
  return {
    id,
    type: 2,
    status,
    createdAt: NOW,
    participants: [
      {
        homeId: `${id}-mine`,
        userId: ME,
        displayName: 'Ana',
        givesHomeId: `${id}-mine`,
        receivesHomeId: `${id}-theirs`,
        compensationCents: 0,
        status: mine,
      },
      {
        homeId: `${id}-theirs`,
        userId: 'user-other',
        displayName: 'Beto',
        givesHomeId: `${id}-theirs`,
        receivesHomeId: `${id}-mine`,
        compensationCents: 0,
        status: 'pending',
      },
    ],
  };
}

function setup(records: MatchRecord[] = [], homes: Home[] = []) {
  const users = new InMemoryUserRepository([
    makeUser({
      id: ME,
      email: 'ana@example.com',
      displayName: 'Ana',
      phone: '+34600111222',
      municipality: 'Getafe',
    }),
  ]);
  const homeRepository = new InMemoryHomeRepository();
  for (const home of homes) homeRepository.homes.set(home.id, home);
  const reader = new InMemoryMatchReader(records);
  const audit = new InMemoryAuditLog();
  const outbox = new InMemoryOutbox();
  const matches = new InMemoryMatchUnitOfWork(reader, audit, outbox);
  const units = new InMemoryAccountDeletion(users, homeRepository, matches, reader, audit, outbox);
  let sequence = 0;
  return {
    users,
    homes: homeRepository,
    reader,
    audit,
    outbox,
    units,
    run: (userId = ME) =>
      deleteAccount(
        { units, clock: { now: () => NOW }, ids: { next: () => `evento-${String(++sequence)}` } },
        userId,
      ),
  };
}

describe('deleteAccount', () => {
  it('Scenario: Datos tras la eliminación - anonimiza el email, el nombre, el teléfono y el municipio', async () => {
    const { run, users } = setup();

    await run();

    expect(users.users.get(ME)).toMatchObject({
      email: `deleted+${ME}@changehouse.invalid`,
      displayName: 'Usuario eliminado',
      phone: null,
      municipality: null,
      deletedAt: NOW,
      firebaseUid: 'uid-1',
    });
  });

  it('Scenario: Datos tras la eliminación - borra la dirección y la ubicación exactas de sus viviendas', async () => {
    const { run, units } = setup([], [homeOf('h-pub', ME)]);

    await run();

    expect(units.exactErased).toEqual([ME]);
  });

  it('si la eliminación falla no queda borrada ninguna dirección', async () => {
    const { run, units, audit } = setup([], [homeOf('h-pub', ME)]);
    audit.failWith = new Error('auditoría caída');

    await expect(run()).rejects.toThrow();

    expect(units.exactErased).toEqual([]);
  });

  it('Scenario: Eliminación completa - cierra todas sus viviendas, también las no publicadas', async () => {
    const { run, homes } = setup(
      [],
      [
        homeOf('h-pub', ME),
        homeOf('h-draft', ME, 'draft'),
        homeOf('h-paused', ME, 'paused'),
        homeOf('h-other', 'user-other'),
      ],
    );

    await run();

    expect(homes.homes.get('h-pub')?.status).toBe('closed');
    expect(homes.homes.get('h-draft')?.status).toBe('closed');
    expect(homes.homes.get('h-paused')?.status).toBe('closed');
    expect(homes.homes.get('h-other')?.status).toBe('published');
  });

  it('Scenario: Eliminación completa - cierra para todos sus matches abiertos o confirmados con el participante withdrawn', async () => {
    const { run, reader, audit, outbox } = setup([
      match('open', 'open'),
      match('confirmed', 'confirmed', 'confirmed'),
      match('closed', 'closed'),
    ]);

    await run();

    const byId = (id: string) => reader.records.find((record) => record.id === id);
    expect(byId('open')?.status).toBe('closed');
    expect(byId('open')?.participants.map((p) => p.status)).toEqual(['withdrawn', 'pending']);
    expect(byId('confirmed')?.status).toBe('closed');
    expect(byId('confirmed')?.participants[0]?.status).toBe('withdrawn');
    // Un match ya cerrado no se toca
    expect(byId('closed')?.participants.map((p) => p.status)).toEqual(['pending', 'pending']);
    expect(audit.entries).toContainEqual({
      actorId: ME,
      action: 'match.withdraw',
      entity: 'match',
      entityId: 'open',
      at: NOW,
    });
    expect(audit.entries.filter((e) => e.action === 'match.withdraw')).toHaveLength(2);
    expect(
      outbox.events.filter((e) => e.type === 'match.closed').map((e) => e.aggregateId),
    ).toEqual(['confirmed', 'open']);
  });

  it('audita user.delete con el propio usuario como actor y entidad', async () => {
    const { run, audit } = setup();

    await run();

    expect(audit.entries).toEqual([
      { actorId: ME, action: 'user.delete', entity: 'user', entityId: ME, at: NOW },
    ]);
  });

  it('borra los datos derivados y encola la baja en el proveedor de identidad en la misma transacción', async () => {
    const { run, units, outbox } = setup();

    await run();

    expect(units.erased).toEqual([ME]);
    expect(outbox.events.filter((e) => e.type === USER_DELETED)).toEqual([
      expect.objectContaining({ aggregateId: ME, processedAt: null }),
    ]);
  });

  it('encola el aviso de cierre de cada match antes que la baja de la cuenta', async () => {
    const { run, outbox } = setup([match('m1', 'open')]);

    await run();

    expect(outbox.events.map((e) => e.type)).toEqual(['match.closed', USER_DELETED]);
  });

  it('GIVEN una vivienda en operación WHEN elimina THEN es un conflicto y no cambia nada', async () => {
    const { run, users, homes, reader, audit, outbox, units } = setup(
      [match('m1', 'open')],
      [homeOf('h-ok', ME), homeOf('h-op', ME, 'in_operation')],
    );

    await expect(run()).rejects.toBeInstanceOf(HomeInOperationError);

    expect(users.users.get(ME)?.deletedAt).toBeNull();
    expect(users.users.get(ME)?.email).toBe('ana@example.com');
    expect(homes.homes.get('h-ok')?.status).toBe('published');
    expect(reader.records[0]?.status).toBe('open');
    expect(audit.entries).toEqual([]);
    expect(outbox.events).toEqual([]);
    expect(units.erased).toEqual([]);
  });

  it('un fallo a mitad de la transacción deshace todo lo escrito', async () => {
    const { run, users, homes, audit, units } = setup([match('m1', 'open')], [homeOf('h1', ME)]);
    audit.failWith = new Error('auditoría caída');

    await expect(run()).rejects.toThrow('auditoría caída');

    expect(users.users.get(ME)?.deletedAt).toBeNull();
    expect(homes.homes.get('h1')?.status).toBe('published');
    expect(units.erased).toEqual([]);
  });

  it('eliminar una cuenta ya eliminada no repite nada', async () => {
    const { run, audit, outbox } = setup();
    await run();

    await run();

    expect(audit.entries).toHaveLength(1);
    expect(outbox.events).toHaveLength(1);
  });

  it('una cuenta inexistente no hace nada', async () => {
    const { run, audit, outbox } = setup();

    await run('nadie');

    expect(audit.entries).toEqual([]);
    expect(outbox.events).toEqual([]);
  });

  it('un match que se cerró entre la lectura y el bloqueo se omite sin fallar', async () => {
    const { run, reader, units } = setup([match('m1', 'open')]);
    // Otro proceso lo cierra justo después de listar los matches vivos
    const original = units.liveMatchIds.bind(units);
    units.liveMatchIds = async (userId) => {
      const ids = await original(userId);
      reader.records[0] = match('m1', 'closed');
      return [...ids, 'inexistente'];
    };

    await run();

    expect(reader.records[0]?.participants[0]?.status).toBe('pending');
  });
});
