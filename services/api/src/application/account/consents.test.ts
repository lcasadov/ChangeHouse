import { describe, expect, it } from 'vitest';

import { InMemoryUserRepository } from '../../../test/fakes.js';
import { acceptConsent, listMyConsents } from './consents.js';

const FIRST = new Date('2026-04-01T09:00:00.000Z');
const SECOND = new Date('2026-10-19T10:00:00.000Z');

function setup() {
  const repository = new InMemoryUserRepository();
  let now = FIRST;
  const deps = { consents: repository, clock: { now: () => now } };
  return {
    repository,
    at: (date: Date) => {
      now = date;
    },
    accept: (userId: string, type: 'privacy' | 'terms' | 'analytics', version: string) =>
      acceptConsent(deps, userId, { type, version }),
    list: (userId: string) => listMyConsents(deps, userId),
  };
}

describe('consentimientos', () => {
  it('Scenario: Aceptar una nueva versión de la privacidad - conserva la anterior y añade la nueva con su fecha', async () => {
    const { accept, list, at } = setup();
    await accept('u1', 'privacy', '2026-04');
    at(SECOND);

    const created = await accept('u1', 'privacy', '2026-10');

    expect(created).toEqual({ type: 'privacy', version: '2026-10', acceptedAt: SECOND });
    await expect(list('u1')).resolves.toEqual([
      { type: 'privacy', version: '2026-04', acceptedAt: FIRST },
      { type: 'privacy', version: '2026-10', acceptedAt: SECOND },
    ]);
  });

  it('aceptar de nuevo la misma versión no duplica nada y conserva la fecha original', async () => {
    const { accept, list, at } = setup();
    await accept('u1', 'terms', '2026-10');
    at(SECOND);

    const again = await accept('u1', 'terms', '2026-10');

    expect(again.acceptedAt).toEqual(FIRST);
    await expect(list('u1')).resolves.toHaveLength(1);
  });

  it('cada usuario ve solo sus consentimientos', async () => {
    const { accept, list } = setup();
    await accept('u1', 'analytics', '1');
    await accept('u2', 'terms', '2026-10');

    await expect(list('u1')).resolves.toEqual([
      { type: 'analytics', version: '1', acceptedAt: FIRST },
    ]);
    await expect(list('sin-consentimientos')).resolves.toEqual([]);
  });
});
