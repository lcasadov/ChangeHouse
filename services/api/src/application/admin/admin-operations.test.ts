import { describe, expect, it } from 'vitest';

import { resolvePeriod } from '../../domain/admin/period.js';
import { encodeCursor } from '../moderation/cursor.js';
import {
  adminOperations,
  type AuditRecord,
  type DirectoryUser,
  type ProductMetrics,
  type WaitlistRecord,
} from './admin-operations.js';

const AT = new Date('2026-10-20T10:00:00.000Z');
const METRICS: ProductMetrics = {
  signups: 4,
  publishedHomesByZone: [{ zone: 'Getafe', count: 2 }],
  likes: 7,
  matches: { direct: 2, chain: 1 },
  operations: 1,
};

function user(id: string, changes: Partial<DirectoryUser> = {}): DirectoryUser {
  return {
    id,
    email: `${id}@example.com`,
    displayName: id,
    assignedRole: null,
    hasPublishedHome: false,
    suspended: false,
    createdAt: AT,
    ...changes,
  };
}

function waitlist(n: number): WaitlistRecord {
  return {
    id: `id-${String(n).padStart(2, '0')}`,
    email: `w${String(n)}@example.com`,
    municipality: 'Getafe',
    homeType: 'piso',
    lookingFor: 'Algo',
    consentAt: new Date(AT.getTime() - n * 1000),
  };
}

function setup(
  options: { users?: DirectoryUser[]; audit?: AuditRecord[]; waitlist?: WaitlistRecord[] } = {},
) {
  const calls = {
    metrics: [] as unknown[],
    users: [] as unknown[],
    audit: [] as unknown[],
    waitlist: [] as unknown[],
  };
  const operations = adminOperations({
    metrics: {
      read: (window) => {
        calls.metrics.push(window);
        return Promise.resolve(METRICS);
      },
    },
    users: {
      search: (query) => {
        calls.users.push(query);
        return Promise.resolve((options.users ?? []).slice(0, query.limit));
      },
    },
    audit: {
      list: (query) => {
        calls.audit.push(query);
        return Promise.resolve((options.audit ?? []).slice(0, query.limit));
      },
    },
    waitlist: {
      list: (query) => {
        calls.waitlist.push(query);
        const all = options.waitlist ?? [];
        const from = query.after ? all.findIndex((entry) => entry.id === query.after?.id) + 1 : 0;
        return Promise.resolve(all.slice(from, from + query.limit));
      },
    },
  });
  return { operations, calls };
}

describe('adminGetMetrics', () => {
  it('Scenario: Métricas de un mes - consulta la ventana del periodo y devuelve los totales', async () => {
    const { operations, calls } = setup();
    const resolved = resolvePeriod('2026-10-01', '2026-10-31');
    if (!resolved.success) throw new Error('periodo válido');

    const metrics = await operations.adminGetMetrics(resolved.period);

    expect(metrics).toEqual(METRICS);
    expect(calls.metrics).toEqual([
      { start: new Date('2026-09-30T22:00:00.000Z'), end: new Date('2026-10-31T23:00:00.000Z') },
    ]);
  });
});

describe('adminListUsers', () => {
  it('Scenario: Buscar un usuario - devuelve el rol derivado y el estado', async () => {
    const { operations } = setup({
      users: [
        user('ana', { hasPublishedHome: true }),
        user('beto', { suspended: true }),
        user('root', { assignedRole: 'admin' }),
      ],
    });

    const page = await operations.adminListUsers({ q: 'ana@', limit: 20 });

    expect(page.nextCursor).toBeNull();
    expect(page.items).toEqual([
      expect.objectContaining({ id: 'ana', roles: ['owner'], suspended: false }),
      expect.objectContaining({ id: 'beto', roles: ['seeker'], suspended: true }),
      expect.objectContaining({ id: 'root', roles: ['admin'], suspended: false }),
    ]);
    expect(page.items[0]).toEqual({
      id: 'ana',
      email: 'ana@example.com',
      displayName: 'ana',
      roles: ['owner'],
      suspended: false,
      createdAt: AT.toISOString(),
    });
  });

  it('pide una fila más que el límite y emite cursor solo si hay otra página', async () => {
    const { operations, calls } = setup({ users: [user('a'), user('b'), user('c')] });

    const first = await operations.adminListUsers({ limit: 2 });

    expect(calls.users).toEqual([{ limit: 3 }]);
    expect(first.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(first.nextCursor).toBe(encodeCursor({ at: AT, id: 'b' }));
  });

  it('pasa el texto de búsqueda y la posición al almacén', async () => {
    const { operations, calls } = setup();
    const cursor = { at: AT, id: 'b' };

    await operations.adminListUsers({ q: 'ana', cursor, limit: 5 });

    expect(calls.users).toEqual([{ q: 'ana', after: cursor, limit: 6 }]);
  });
});

describe('adminListAuditLog', () => {
  const entries: AuditRecord[] = [3, 2, 1].map((id) => ({
    id,
    actorId: 'admin-1',
    action: 'user.suspend',
    entity: 'user',
    entityId: `u-${String(id)}`,
    at: new Date(AT.getTime() - id * 1000),
  }));

  it('Scenario: Ver la auditoría - cada acción con autor, entidad y fecha', async () => {
    const { operations } = setup({ audit: entries });

    const page = await operations.adminListAuditLog({ limit: 20 });

    expect(page.items[0]).toEqual({
      id: 3,
      actorId: 'admin-1',
      action: 'user.suspend',
      entity: 'user',
      entityId: 'u-3',
      at: new Date(AT.getTime() - 3000).toISOString(),
    });
    expect(page.items.map((item) => item.id)).toEqual([3, 2, 1]);
    expect(page.nextCursor).toBeNull();
  });

  it('el cursor de la siguiente página lleva el instante y el id numérico de la última entrada', async () => {
    const { operations, calls } = setup({ audit: entries });

    const page = await operations.adminListAuditLog({ limit: 2 });

    expect(calls.audit).toEqual([{ limit: 3 }]);
    expect(page.items.map((item) => item.id)).toEqual([3, 2]);
    expect(page.nextCursor).toBe(encodeCursor({ at: new Date(AT.getTime() - 2000), id: '2' }));
  });
});

describe('lista de espera', () => {
  const all = [1, 2, 3, 4, 5].map(waitlist);

  it('lista una página filtrada por municipio con el contrato de WaitlistEntry', async () => {
    const { operations, calls } = setup({ waitlist: all });

    const page = await operations.adminListWaitlist({ municipality: 'Getafe', limit: 2 });

    expect(calls.waitlist).toEqual([{ municipality: 'Getafe', limit: 3 }]);
    expect(page.items).toEqual([
      {
        email: 'w1@example.com',
        municipality: 'Getafe',
        homeType: 'piso',
        lookingFor: 'Algo',
        consentAt: new Date(AT.getTime() - 1000).toISOString(),
      },
      expect.objectContaining({ email: 'w2@example.com' }),
    ]);
    expect(page.nextCursor).toBe(encodeCursor({ at: new Date(AT.getTime() - 2000), id: 'id-02' }));
  });

  it('la exportación recorre todas las páginas', async () => {
    const many = Array.from({ length: 1201 }, (_, index) => waitlist(index + 1));
    const { operations, calls } = setup({ waitlist: many });

    const rows = await operations.adminExportWaitlist({ municipality: 'Getafe' });

    expect(rows).toHaveLength(1201);
    expect(rows[0]?.email).toBe('w1@example.com');
    expect(rows.at(-1)?.email).toBe('w1201@example.com');
    expect(calls.waitlist.length).toBeGreaterThan(1);
  });
});
