import { describe, expect, it } from 'vitest';

import { FixedHomeOwnership, InMemoryUserRepository } from '../../../test/fakes.js';
import type { VerifiedIdentity } from '../auth/identity-verifier.js';
import { accountOperations } from './account-operations.js';

const NOW = new Date('2026-10-19T10:00:00.000Z');
const identity: VerifiedIdentity = { uid: 'uid-1', email: 'ana@example.com', emailVerified: true };

function setup() {
  const repository = new InMemoryUserRepository();
  let sequence = 0;
  return accountOperations({
    users: repository,
    consents: repository,
    ownership: new FixedHomeOwnership(),
    clock: { now: () => NOW },
    ids: { next: () => `id-${String(++sequence)}` },
    legalVersions: { terms: '2026-10', privacy: '2026-10' },
  });
}

describe('accountOperations', () => {
  it('el recorrido completo de una cuenta: alta, consulta, nueva aceptación y listado', async () => {
    const operations = setup();

    const signUp = await operations.upsertMe({
      identity,
      input: {
        displayName: 'Ana',
        acceptedTermsVersion: '2026-10',
        acceptedPrivacyVersion: '2026-10',
      },
    });
    const me = await operations.getMe('id-1');
    await operations.acceptConsent('id-1', { type: 'privacy', version: '2027-01' });
    const consents = await operations.listMyConsents('id-1');

    expect(signUp.created).toBe(true);
    expect(me).toEqual(signUp.me);
    expect(consents.map((consent) => `${consent.type}:${consent.version}`)).toEqual([
      'terms:2026-10',
      'privacy:2026-10',
      'privacy:2027-01',
    ]);
  });
});
