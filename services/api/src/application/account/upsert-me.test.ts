import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { FixedHomeOwnership, InMemoryUserRepository, makeUser } from '../../../test/fakes.js';
import { LegalAcceptanceRequiredError } from '../../domain/account/consent.js';
import type { VerifiedIdentity } from '../auth/identity-verifier.js';
import { EmailAlreadyRegisteredError, IdentityEmailRequiredError } from './errors.js';
import { upsertMe, type UpsertMeInput } from './upsert-me.js';

const NOW = new Date('2026-10-19T10:00:00.000Z');
const LEGAL = { terms: '2026-10', privacy: '2026-10' };
const identity: VerifiedIdentity = { uid: 'uid-1', email: 'Ana@Example.com', emailVerified: true };
const signUpInput: UpsertMeInput = {
  displayName: 'Ana',
  acceptedTermsVersion: '2026-10',
  acceptedPrivacyVersion: '2026-10',
};

function setup(initial: Parameters<typeof makeUser>[0][] = [], owners: string[] = []) {
  const repository = new InMemoryUserRepository(initial.map((user) => makeUser(user)));
  let sequence = 0;
  const deps = {
    users: repository,
    ownership: new FixedHomeOwnership(new Set(owners)),
    clock: { now: () => NOW },
    ids: { next: () => `id-${String(++sequence)}` },
    legalVersions: LEGAL,
  };
  return {
    repository,
    run: (input: UpsertMeInput, who: VerifiedIdentity = identity) =>
      upsertMe(deps, { identity: who, input }),
  };
}

describe('upsertMe', () => {
  it('Scenario: Primer acceso completo - da de alta al usuario y registra los dos consentimientos con su versión y fecha', async () => {
    const { repository, run } = setup();

    const result = await run({ ...signUpInput, municipality: 'Madrid', isOver65: true });

    expect(result.created).toBe(true);
    expect(result.me).toEqual({
      id: 'id-1',
      email: 'ana@example.com',
      displayName: 'Ana',
      municipality: 'Madrid',
      phone: null,
      meetsVppRequirements: false,
      isOver65: true,
      roles: ['seeker'],
      hasPublishedHome: false,
      suspended: false,
    });
    expect(repository.users.get('id-1')).toMatchObject({
      firebaseUid: 'uid-1',
      email: 'ana@example.com',
      assignedRole: null,
      createdAt: NOW,
    });
    expect(repository.consents).toEqual([
      { userId: 'id-1', consent: { type: 'terms', version: '2026-10', acceptedAt: NOW } },
      { userId: 'id-1', consent: { type: 'privacy', version: '2026-10', acceptedAt: NOW } },
    ]);
  });

  it.each([
    ['ninguna', {}, ['acceptedTermsVersion', 'acceptedPrivacyVersion']],
    ['solo los términos', { acceptedTermsVersion: '2026-10' }, ['acceptedPrivacyVersion']],
    ['solo la privacidad', { acceptedPrivacyVersion: '2026-10' }, ['acceptedTermsVersion']],
    [
      'versiones anteriores',
      { acceptedTermsVersion: '2026-04', acceptedPrivacyVersion: '2026-10' },
      ['acceptedTermsVersion'],
    ],
  ])(
    'Scenario: Sin aceptar los textos legales - con %s no se completa el alta y se señala qué falta',
    async (_label, accepted, fields) => {
      const { repository, run } = setup();

      const failure = await run({ displayName: 'Ana', ...accepted }).catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(LegalAcceptanceRequiredError);
      expect((failure as LegalAcceptanceRequiredError).fields).toEqual(fields);
      expect(repository.users.size).toBe(0);
      expect(repository.consents).toEqual([]);
    },
  );

  it('Scenario: Alta repetida - no crea un segundo usuario y actualiza solo los datos enviados', async () => {
    const { repository, run } = setup();
    await run({ ...signUpInput, municipality: 'Madrid', phone: '+34600111222' });

    const again = await run({ displayName: 'Ana María', isOver65: true });

    expect(again.created).toBe(false);
    expect(repository.users.size).toBe(1);
    expect(again.me).toMatchObject({
      id: 'id-1',
      displayName: 'Ana María',
      isOver65: true,
      municipality: 'Madrid',
      phone: '+34600111222',
    });
    expect(repository.consents).toHaveLength(2);
  });

  it('Scenario: Borrar el teléfono del perfil - phone null lo borra y omitirlo no lo toca', async () => {
    const { repository, run } = setup();
    await run({ ...signUpInput, phone: '+34600111222' });

    const untouched = await run({ displayName: 'Ana' });
    const cleared = await run({ displayName: 'Ana', phone: null });

    expect(untouched.me.phone).toBe('+34600111222');
    expect(cleared.me.phone).toBeNull();
    expect(repository.users.get('id-1')?.phone).toBeNull();
  });

  it('Scenario: Guardar cambios del perfil - un municipio en blanco lo borra y un alta sin municipio lo deja vacío', async () => {
    const { run } = setup();
    const created = await run({ ...signUpInput, municipality: '' });
    await run({ displayName: 'Ana', municipality: 'Madrid' });

    const cleared = await run({ displayName: 'Ana', municipality: '' });

    expect(created.me.municipality).toBeNull();
    expect(cleared.me.municipality).toBeNull();
  });

  it('un usuario ya dado de alta no necesita volver a enviar las versiones legales', async () => {
    const { run } = setup([{ id: 'u1', firebaseUid: 'uid-1', displayName: 'Ana' }]);

    const result = await run({ displayName: 'Ana' });

    expect(result).toMatchObject({ created: false, me: { id: 'u1' } });
  });

  it('el email del alta sale siempre de la identidad verificada, nunca de la petición', async () => {
    const { repository, run } = setup();

    await run({ ...signUpInput });

    expect([...repository.users.values()].map((user) => user.email)).toEqual(['ana@example.com']);
  });

  it('una identidad sin email no puede darse de alta', async () => {
    const { repository, run } = setup();

    await expect(
      run(signUpInput, { uid: 'uid-2', email: undefined, emailVerified: false }),
    ).rejects.toBeInstanceOf(IdentityEmailRequiredError);
    expect(repository.users.size).toBe(0);
  });

  it('un email que ya pertenece a otra identidad se rechaza sin tocar al otro usuario', async () => {
    const { repository, run } = setup([
      { id: 'u9', firebaseUid: 'otra-identidad', email: 'ana@example.com' },
    ]);

    await expect(run(signUpInput)).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    expect(repository.users.size).toBe(1);
    expect(repository.consents).toEqual([]);
  });

  it('un administrador existente conserva su rol en la respuesta', async () => {
    const { run } = setup([{ id: 'u1', firebaseUid: 'uid-1', assignedRole: 'admin' }], ['u1']);

    const result = await run({ displayName: 'Admin' });

    expect(result.me).toMatchObject({ roles: ['admin'], hasPublishedHome: false });
  });

  it('un usuario con vivienda publicada se muestra como owner', async () => {
    const { run } = setup([{ id: 'u1', firebaseUid: 'uid-1' }], ['u1']);

    const result = await run({ displayName: 'Ana' });

    expect(result.me).toMatchObject({ roles: ['owner'], hasPublishedHome: true });
  });

  it('propiedad: repetir el alta cualquier número de veces deja siempre un solo usuario y dos consentimientos', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 6 }),
        fc.string({ minLength: 1 }),
        async (times, name) => {
          const { repository, run } = setup();

          for (let attempt = 0; attempt < times; attempt += 1) {
            await run({ ...signUpInput, displayName: name });
          }

          expect(repository.users.size).toBe(1);
          expect(repository.consents).toHaveLength(2);
        },
      ),
    );
  });
});
