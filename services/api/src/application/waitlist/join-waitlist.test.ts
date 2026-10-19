import { describe, expect, it } from 'vitest';

import { normalizeEmail, type WaitlistEntry } from '../../domain/waitlist/waitlist-entry.js';
import { joinWaitlist, type JoinWaitlistCommand } from './join-waitlist.js';
import type { WaitlistRepository } from './waitlist-repository.js';

const NOW = new Date('2026-10-19T10:00:00.000Z');

/** Repositorio en memoria: reproduce la unicidad del email sin distinguir mayúsculas. */
class InMemoryWaitlistRepository implements WaitlistRepository {
  readonly entries = new Map<string, WaitlistEntry>();

  add(entry: WaitlistEntry): Promise<void> {
    const key = normalizeEmail(entry.email);
    if (!this.entries.has(key)) this.entries.set(key, entry);
    return Promise.resolve();
  }
}

function setup() {
  const repository = new InMemoryWaitlistRepository();
  let sequence = 0;
  const deps = {
    repository,
    clock: { now: () => NOW },
    ids: { next: () => `id-${String(++sequence)}` },
  };
  return { repository, run: (command: JoinWaitlistCommand) => joinWaitlist(deps, command) };
}

const command: JoinWaitlistCommand = {
  email: 'Juan@Example.com',
  municipality: 'Madrid',
  homeType: 'piso',
  lookingFor: 'Un ático con terraza',
  consent: true,
};

describe('joinWaitlist', () => {
  it('Scenario: Alta correcta - el repositorio recibe la inscripción con la fecha de consentimiento', async () => {
    const { repository, run } = setup();

    const result = await run(command);

    expect(result).toEqual({ accepted: true });
    expect([...repository.entries.values()]).toEqual([
      {
        id: 'id-1',
        email: 'juan@example.com',
        municipality: 'Madrid',
        homeType: 'piso',
        lookingFor: 'Un ático con terraza',
        consentAt: NOW,
      },
    ]);
  });

  it('Scenario: Email ya inscrito - otra capitalización no crea una segunda inscripción y se informa igual', async () => {
    const { repository, run } = setup();

    const first = await run(command);
    const second = await run({ ...command, email: 'JUAN@EXAMPLE.COM', municipality: 'Getafe' });

    expect(second).toEqual(first);
    expect(repository.entries.size).toBe(1);
    expect([...repository.entries.values()][0]?.municipality).toBe('Madrid');
  });

  it('Scenario: Sin aceptar la privacidad - el caso de uso no guarda nada', async () => {
    const { repository, run } = setup();

    await expect(run({ ...command, consent: false as unknown as true })).rejects.toThrow();

    expect(repository.entries.size).toBe(0);
  });
});
