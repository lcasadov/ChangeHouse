import { describe, expect, it } from 'vitest';

import { matchEnv } from '../../../test/match-env.js';
import { decodeCursor, encodeCursor } from '../moderation/cursor.js';
import type { MatchRecord } from './matching-repository.js';

const ME = 'user-me';

function record(id: string, createdAt: string, overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id,
    type: 2,
    status: 'open',
    createdAt: new Date(createdAt),
    participants: [
      {
        homeId: `${id}-mine`,
        userId: ME,
        displayName: 'Ana',
        givesHomeId: `${id}-mine`,
        receivesHomeId: `${id}-theirs`,
        compensationCents: 1_200_000,
        status: 'pending',
      },
      {
        homeId: `${id}-theirs`,
        userId: 'user-other',
        displayName: 'Beto',
        givesHomeId: `${id}-theirs`,
        receivesHomeId: `${id}-mine`,
        compensationCents: -1_200_000,
        status: 'pending',
      },
    ],
    ...overrides,
  };
}

const setup = matchEnv;

describe('listMyMatches', () => {
  it('Scenario: Ver mis matches - ve los dos, el más reciente primero, cada uno con su compensación', async () => {
    const { operations, reader } = setup([
      record('older', '2026-10-18T10:00:00.000Z'),
      record('newer', '2026-10-19T10:00:00.000Z'),
    ]);

    const page = await operations.listMyMatches(ME, { limit: 20 });

    expect(page.nextCursor).toBeNull();
    expect(page.items.map((match) => match.id)).toEqual(['newer', 'older']);
    expect(page.items[0]).toEqual({
      id: 'newer',
      type: 2,
      status: 'open',
      createdAt: '2026-10-19T10:00:00.000Z',
      participants: [
        {
          homeId: 'newer-mine',
          displayName: 'Ana',
          givesHomeId: 'newer-mine',
          receivesHomeId: 'newer-theirs',
          compensationCents: 1_200_000,
          status: 'pending',
        },
        {
          homeId: 'newer-theirs',
          displayName: 'Beto',
          givesHomeId: 'newer-theirs',
          receivesHomeId: 'newer-mine',
          compensationCents: -1_200_000,
          status: 'pending',
        },
      ],
    });
    expect(reader.queries).toEqual([{ userId: ME, limit: 21 }]);
  });

  it('Scenario: Sin matches - un usuario sin matches recibe una lista vacía', async () => {
    const { operations } = setup([]);

    await expect(operations.listMyMatches(ME, { limit: 20 })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('pagina con un cursor tras el último de la página cuando hay más', async () => {
    const { operations, reader } = setup([
      record('a', '2026-10-17T10:00:00.000Z'),
      record('b', '2026-10-18T10:00:00.000Z'),
      record('c', '2026-10-19T10:00:00.000Z'),
    ]);

    const first = await operations.listMyMatches(ME, { limit: 2 });
    const after = decodeCursor(first.nextCursor ?? '');
    const second = await operations.listMyMatches(ME, {
      limit: 2,
      ...(after ? { after } : {}),
    });

    expect(first.items.map((match) => match.id)).toEqual(['c', 'b']);
    expect(first.nextCursor).toBe(
      encodeCursor({ at: new Date('2026-10-18T10:00:00.000Z'), id: 'b' }),
    );
    expect(second.items.map((match) => match.id)).toEqual(['a']);
    expect(second.nextCursor).toBeNull();
    expect(reader.queries[1]).toEqual({ userId: ME, after, limit: 3 });
  });

  it('pasa el filtro de estado al almacén', async () => {
    const { operations, reader } = setup([
      record('open', '2026-10-18T10:00:00.000Z'),
      record('closed', '2026-10-19T10:00:00.000Z', { status: 'closed' }),
    ]);

    const page = await operations.listMyMatches(ME, { status: 'closed', limit: 20 });

    expect(page.items.map((match) => match.id)).toEqual(['closed']);
    expect(reader.queries).toEqual([{ userId: ME, status: 'closed', limit: 21 }]);
  });
});
