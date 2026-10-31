import { describe, expect, it } from 'vitest';

import { MATCH_NOW, matchEnv } from '../../../test/match-env.js';
import { type Home, newDraft } from '../../domain/home/home.js';
import { MatchNotFoundError, MatchNotOpenError } from '../../domain/matching/errors.js';
import type { MatchRecord } from './matching-repository.js';

const ME = 'user-me';
const OTHER = 'user-other';
const MATCH_ID = 'match-1';
const ANA_HOME = 'home-ana';
const BETO_HOME = 'home-beto';
const BETO_PHONE = '+34600111222';
const ANA_PHONE = '+34699888777';
const PHOTOS = [1, 2, 3];

const LOCATION = {
  exact: { lat: 40.3056, lng: -3.7321 },
  areaName: 'Getafe Centro',
  areaCenter: { lat: 40.306, lng: -3.7325 },
};

type ParticipantStatus = MatchRecord['participants'][number]['status'];

function home(id: string, ownerId: string, address: string): Home {
  return newDraft({
    id,
    ownerId,
    now: new Date('2026-10-01T09:00:00.000Z'),
    type: 'piso',
    address,
    location: LOCATION,
  });
}

function pairMatch(
  status: MatchRecord['status'] = 'open',
  mine: ParticipantStatus = 'pending',
  theirs: ParticipantStatus = 'pending',
): MatchRecord {
  return {
    id: MATCH_ID,
    type: 2,
    status,
    createdAt: new Date('2026-10-19T10:00:00.000Z'),
    participants: [
      {
        homeId: ANA_HOME,
        userId: ME,
        displayName: 'Ana',
        givesHomeId: ANA_HOME,
        receivesHomeId: BETO_HOME,
        compensationCents: 1_200_000,
        status: mine,
      },
      {
        homeId: BETO_HOME,
        userId: OTHER,
        displayName: 'Beto',
        givesHomeId: BETO_HOME,
        receivesHomeId: ANA_HOME,
        compensationCents: -1_200_000,
        status: theirs,
      },
    ],
  };
}

function setup(record: MatchRecord = pairMatch()) {
  const env = matchEnv([record]);
  env.homes.homes.set(ANA_HOME, home(ANA_HOME, ME, 'Calle Mayor, 1, Getafe'));
  env.homes.homes.set(BETO_HOME, home(BETO_HOME, OTHER, 'Calle Real, 9, Leganés'));
  for (const homeId of [ANA_HOME, BETO_HOME]) {
    for (const position of PHOTOS) {
      const id = `${homeId}-photo-${String(position)}`;
      env.photos.photos.set(id, {
        id,
        homeId,
        status: 'ready',
        storagePath: `homes/${homeId}/${String(position)}.webp`,
        position,
        createdAt: MATCH_NOW,
      });
    }
  }
  env.reader.phones.set(ME, ANA_PHONE);
  env.reader.phones.set(OTHER, BETO_PHONE);
  return env;
}

const AS_ANA = { userId: ME, role: 'owner' } as const;

/** El participante de esa vivienda tal como llega al cliente, para comprobar campos presentes o ausentes. */
function participantOf(
  detail: { participants: { homeId: string }[] },
  homeId: string,
): Record<string, unknown> | undefined {
  return detail.participants.find((p) => p.homeId === homeId);
}

describe('getMatch', () => {
  it('Scenario: Participante ve el detalle - dirección exacta de la otra vivienda, galería completa, nombre y compensación', async () => {
    const { operations } = setup();

    const detail = await operations.getMatch(AS_ANA, MATCH_ID);

    expect(detail).toMatchObject({ id: MATCH_ID, type: 2, status: 'open' });
    expect(participantOf(detail, BETO_HOME)).toMatchObject({
      displayName: 'Beto',
      exactAddress: 'Calle Real, 9, Leganés',
      compensationCents: -1_200_000,
      phone: null,
      sharesPhone: false,
    });
    expect(participantOf(detail, ANA_HOME)).toMatchObject({
      exactAddress: 'Calle Mayor, 1, Getafe',
      compensationCents: 1_200_000,
      sharesPhone: false,
    });
    expect(detail.homes.map((h) => h.id)).toEqual([ANA_HOME, BETO_HOME]);
    expect(detail.homes[1]?.photos).toEqual([
      { id: 'home-beto-photo-1', url: 'https://cdn.test/homes/home-beto/1.webp', position: 1 },
      { id: 'home-beto-photo-2', url: 'https://cdn.test/homes/home-beto/2.webp', position: 2 },
      { id: 'home-beto-photo-3', url: 'https://cdn.test/homes/home-beto/3.webp', position: 3 },
    ]);
    // La vivienda lleva su forma pública: nunca la dirección ni el propietario
    expect(JSON.stringify(detail.homes)).not.toContain('Calle Real');
    expect(detail.homes[1]).not.toHaveProperty('ownerId');
  });

  it('Scenario: Sin autorización - el teléfono de quien no lo ha autorizado es nulo, aunque tenga uno', async () => {
    const { operations } = setup();

    const detail = await operations.getMatch(AS_ANA, MATCH_ID);

    expect(participantOf(detail, BETO_HOME)?.['phone']).toBeNull();
    expect(JSON.stringify(detail)).not.toContain(BETO_PHONE);
  });

  it('Scenario: Autorizar y revocar - los demás ven el teléfono tras autorizar y dejan de verlo tras revocar', async () => {
    const { operations } = setup();

    await operations.setPhoneSharing(OTHER, MATCH_ID, true);
    const shared = await operations.getMatch(AS_ANA, MATCH_ID);
    await operations.setPhoneSharing(OTHER, MATCH_ID, false);
    const revoked = await operations.getMatch(AS_ANA, MATCH_ID);

    expect(participantOf(shared, BETO_HOME)?.['phone']).toBe(BETO_PHONE);
    expect(participantOf(shared, ANA_HOME)?.['phone']).toBeNull();
    expect(participantOf(shared, BETO_HOME)?.['sharesPhone']).toBe(true);
    expect(participantOf(shared, ANA_HOME)?.['sharesPhone']).toBe(false);
    expect(participantOf(revoked, BETO_HOME)?.['phone']).toBeNull();
    expect(participantOf(revoked, BETO_HOME)?.['sharesPhone']).toBe(false);
  });

  it('un participante que autoriza sin teléfono en su perfil sigue con phone nulo', async () => {
    const { operations, reader } = setup();
    reader.phones.delete(OTHER);
    await operations.setPhoneSharing(OTHER, MATCH_ID, true);

    const detail = await operations.getMatch(AS_ANA, MATCH_ID);

    expect(participantOf(detail, BETO_HOME)?.['phone']).toBeNull();
    expect(participantOf(detail, BETO_HOME)?.['sharesPhone']).toBe(true);
  });

  it('Scenario: Usuario ajeno - responde como inexistente y no descifra ninguna dirección', async () => {
    const { operations, matchHomes } = setup();

    await expect(
      operations.getMatch({ userId: 'user-stranger', role: 'owner' }, MATCH_ID),
    ).rejects.toThrow(MatchNotFoundError);
    await expect(
      operations.getMatch({ userId: 'user-stranger', role: 'seeker' }, MATCH_ID),
    ).rejects.toThrow(MatchNotFoundError);

    expect(matchHomes.decrypted).toEqual([]);
    expect(matchHomes.publicReads).toBe(0);
  });

  it('un match inexistente responde igual que uno ajeno', async () => {
    const { operations, matchHomes } = setup();

    await expect(operations.getMatch(AS_ANA, 'no-existe')).rejects.toThrow(MatchNotFoundError);

    expect(matchHomes.decrypted).toEqual([]);
  });

  it('el admin ve el match y las viviendas sin teléfonos ni direcciones exactas', async () => {
    const { operations, matchHomes } = setup();
    await operations.setPhoneSharing(OTHER, MATCH_ID, true);

    const detail = await operations.getMatch({ userId: 'admin-1', role: 'admin' }, MATCH_ID);

    expect(detail.participants).toHaveLength(2);
    expect(detail.homes).toHaveLength(2);
    for (const participant of detail.participants) {
      expect(participant).not.toHaveProperty('phone');
      expect(participant).not.toHaveProperty('exactAddress');
      expect(participant).not.toHaveProperty('sharesPhone');
    }
    expect(JSON.stringify(detail)).not.toContain(BETO_PHONE);
    expect(matchHomes.decrypted).toEqual([]);
  });
});

describe('confirmMatch', () => {
  it('Scenario: Primera confirmación - su estado pasa a confirmed y el match sigue open', async () => {
    const { operations, reader, units } = setup();

    const match = await operations.confirmMatch(ME, MATCH_ID);

    expect(match.status).toBe('open');
    expect(match.participants.map((p) => p.status)).toEqual(['confirmed', 'pending']);
    expect(reader.records[0]?.participants.map((p) => p.status)).toEqual(['confirmed', 'pending']);
    expect(units.locked).toEqual([MATCH_ID]);
    expect(JSON.stringify(match)).not.toContain('Calle');
  });

  it('Scenario: Todos confirman - el match pasa a confirmed', async () => {
    const { operations } = setup(pairMatch('open', 'pending', 'confirmed'));

    const match = await operations.confirmMatch(ME, MATCH_ID);

    expect(match.status).toBe('confirmed');
    expect(match.participants.map((p) => p.status)).toEqual(['confirmed', 'confirmed']);
  });

  it('confirmar dos veces es idempotente: responde con el match y no escribe de nuevo', async () => {
    const { operations, units } = setup();
    await operations.confirmMatch(ME, MATCH_ID);

    const again = await operations.confirmMatch(ME, MATCH_ID);

    expect(again.participants.map((p) => p.status)).toEqual(['confirmed', 'pending']);
    expect(units.saved).toHaveLength(1);
  });

  it('Scenario: Match cerrado - confirmar lanza MatchNotOpenError y no cambia nada', async () => {
    const { operations, units } = setup(pairMatch('closed'));

    await expect(operations.confirmMatch(ME, MATCH_ID)).rejects.toThrow(MatchNotOpenError);

    expect(units.saved).toEqual([]);
  });

  it('quien no participa recibe el mismo error que ante un match inexistente, sin escribir', async () => {
    const { operations, units } = setup();

    await expect(operations.confirmMatch('user-stranger', MATCH_ID)).rejects.toThrow(
      MatchNotFoundError,
    );
    await expect(operations.confirmMatch(ME, 'no-existe')).rejects.toThrow(MatchNotFoundError);

    expect(units.saved).toEqual([]);
  });
});

describe('avisos de cambio de estado en la bandeja de salida', () => {
  it('Scenario: Todos confirman - se registra match.confirmed en la misma transacción, una sola vez', async () => {
    const { operations, outbox } = setup(pairMatch('open', 'pending', 'confirmed'));

    await operations.confirmMatch(ME, MATCH_ID);
    await operations.confirmMatch(ME, MATCH_ID);

    expect(outbox.events).toEqual([
      expect.objectContaining({ type: 'match.confirmed', aggregateId: MATCH_ID }),
    ]);
  });

  it('una confirmación que aún deja el match abierto no avisa a nadie', async () => {
    const { operations, outbox } = setup();

    await operations.confirmMatch(ME, MATCH_ID);

    expect(outbox.events).toEqual([]);
  });

  it('retirarse registra match.closed junto con la auditoría', async () => {
    const { operations, outbox } = setup();

    await operations.withdrawFromMatch(ME, MATCH_ID);

    expect(outbox.events).toEqual([
      expect.objectContaining({ type: 'match.closed', aggregateId: MATCH_ID, processedAt: null }),
    ]);
  });

  it('si la operación falla no queda ningún aviso registrado', async () => {
    const { operations, outbox } = setup(pairMatch('closed'));

    await expect(operations.withdrawFromMatch(ME, MATCH_ID)).rejects.toThrow(MatchNotOpenError);
    await expect(operations.confirmMatch(ME, MATCH_ID)).rejects.toThrow(MatchNotOpenError);

    expect(outbox.events).toEqual([]);
  });
});

describe('withdrawFromMatch', () => {
  it('Scenario: Retirarse - el match pasa a closed, el participante a withdrawn y queda auditado', async () => {
    const { operations, reader, audit, units } = setup();

    const match = await operations.withdrawFromMatch(ME, MATCH_ID);

    expect(match.status).toBe('closed');
    expect(match.participants.map((p) => p.status)).toEqual(['withdrawn', 'pending']);
    expect(reader.records[0]?.status).toBe('closed');
    expect(audit.entries).toEqual([
      { actorId: ME, action: 'match.withdraw', entity: 'match', entityId: MATCH_ID, at: MATCH_NOW },
    ]);
    expect(units.locked).toEqual([MATCH_ID]);
    // Los demás participantes lo ven cerrado
    const theirs = await operations.getMatch({ userId: OTHER, role: 'owner' }, MATCH_ID);
    expect(theirs.status).toBe('closed');
  });

  it('también se puede retirar desde confirmed', async () => {
    const { operations } = setup(pairMatch('confirmed', 'confirmed', 'confirmed'));

    const match = await operations.withdrawFromMatch(OTHER, MATCH_ID);

    expect(match.status).toBe('closed');
  });

  it('en un match cerrado responde 409 y no audita', async () => {
    const { operations, audit } = setup(pairMatch('closed'));

    await expect(operations.withdrawFromMatch(ME, MATCH_ID)).rejects.toThrow(MatchNotOpenError);

    expect(audit.entries).toEqual([]);
  });

  it('si falla el registro de auditoría la retirada no queda aplicada', async () => {
    const { operations, audit, reader } = setup();
    audit.failWith = new Error('auditoría caída');

    await expect(operations.withdrawFromMatch(ME, MATCH_ID)).rejects.toThrow('auditoría caída');

    expect(reader.records[0]?.status).toBe('open');
    expect(reader.records[0]?.participants.map((p) => p.status)).toEqual(['pending', 'pending']);
  });

  it('quien no participa recibe el error de un match inexistente, sin auditar', async () => {
    const { operations, audit } = setup();

    await expect(operations.withdrawFromMatch('user-stranger', MATCH_ID)).rejects.toThrow(
      MatchNotFoundError,
    );

    expect(audit.entries).toEqual([]);
  });
});

describe('setPhoneSharing', () => {
  it('cambia solo la fila del propio participante, también en un match confirmed', async () => {
    const { operations, reader } = setup(pairMatch('confirmed', 'confirmed', 'confirmed'));

    await operations.setPhoneSharing(ME, MATCH_ID, true);

    expect([...reader.sharing]).toEqual([`${MATCH_ID}|${ME}`]);
  });

  it('en un match cerrado responde 409', async () => {
    const { operations, reader } = setup(pairMatch('closed'));

    await expect(operations.setPhoneSharing(ME, MATCH_ID, true)).rejects.toThrow(MatchNotOpenError);

    expect(reader.sharing.size).toBe(0);
  });

  it('quien no participa recibe el error de un match inexistente, sin escribir', async () => {
    const { operations, reader } = setup();

    await expect(operations.setPhoneSharing('user-stranger', MATCH_ID, true)).rejects.toThrow(
      MatchNotFoundError,
    );
    await expect(operations.setPhoneSharing(ME, 'no-existe', true)).rejects.toThrow(
      MatchNotFoundError,
    );

    expect(reader.sharing.size).toBe(0);
  });
});
