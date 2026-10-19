import { HOME_TYPES, type HomeType as SharedHomeType } from '@changehouse/shared';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type { JoinWaitlistCommand } from '../../../application/waitlist/join-waitlist.js';
import {
  createWaitlistEntry,
  type HomeType as DomainHomeType,
} from '../../../domain/waitlist/waitlist-entry.js';
import { buildApp } from '../app.js';

const validBody = {
  email: ' Juan@Example.com ',
  municipality: ' Madrid ',
  homeType: 'piso',
  lookingFor: 'Un ático con terraza',
  consent: true,
};

function setup(max = 5) {
  const joinWaitlist = vi.fn<(command: JoinWaitlistCommand) => Promise<{ accepted: true }>>(() =>
    Promise.resolve({ accepted: true }),
  );
  const app = buildApp({
    landingOrigin: 'https://landing.test',
    waitlist: { joinWaitlist, rateLimit: { max, windowSeconds: 600 } },
  });
  return { app, joinWaitlist };
}

describe('POST /waitlist (adaptador HTTP)', () => {
  it('Scenario: Alta correcta - delega en el caso de uso con los datos recortados y responde 202', async () => {
    const { app, joinWaitlist } = setup();

    const response = await app.inject({ method: 'POST', url: '/v1/waitlist', payload: validBody });

    expect(response.statusCode).toBe(202);
    expect(response.body).toBe('');
    expect(joinWaitlist).toHaveBeenCalledExactlyOnceWith({
      email: 'Juan@Example.com',
      municipality: 'Madrid',
      homeType: 'piso',
      lookingFor: 'Un ático con terraza',
      consent: true,
    });
    await app.close();
  });

  it('Scenario: Email no válido - 400 con el campo señalado y sin llamar al caso de uso', async () => {
    const { app, joinWaitlist } = setup();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/waitlist',
      payload: { ...validBody, email: 'juan@' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ errors: unknown }>().errors).toEqual([
      { field: 'email', message: 'invalid' },
    ]);
    expect(joinWaitlist).not.toHaveBeenCalled();
    await app.close();
  });

  it('Scenario: Demasiadas altas seguidas - 429 con Retry-After sin llamar al caso de uso', async () => {
    const { app, joinWaitlist } = setup(2);

    const statuses: number[] = [];
    let last;
    for (let attempt = 0; attempt < 3; attempt++) {
      last = await app.inject({ method: 'POST', url: '/v1/waitlist', payload: validBody });
      statuses.push(last.statusCode);
    }

    expect(statuses).toEqual([202, 202, 429]);
    expect(last?.headers['content-type']).toContain('application/problem+json');
    expect(Number(last?.headers['retry-after'])).toBeGreaterThan(0);
    expect(last?.json<{ status: number; correlationId: string }>()).toMatchObject({ status: 429 });
    expect(joinWaitlist).toHaveBeenCalledTimes(2);
    await app.close();
  });

  it('el límite es por origen: otra IP no queda bloqueada', async () => {
    const { app } = setup(1);
    const post = (remoteAddress: string) =>
      app.inject({ method: 'POST', url: '/v1/waitlist', payload: validBody, remoteAddress });

    const first = await post('10.0.0.1');
    const blocked = await post('10.0.0.1');
    const other = await post('10.0.0.2');

    expect([first.statusCode, blocked.statusCode, other.statusCode]).toEqual([202, 429, 202]);
    await app.close();
  });
});

describe('contrato de tipos de vivienda', () => {
  it.each(HOME_TYPES)('el dominio acepta el tipo %s del esquema compartido', (homeType) => {
    const entry = createWaitlistEntry({
      id: 'id',
      email: 'a@b.es',
      municipality: 'Madrid',
      homeType,
      lookingFor: 'x',
      consent: true,
      consentAt: new Date(0),
    });

    expect(entry.homeType).toBe(homeType);
    // Falla al compilar si el dominio admite un tipo que el contrato no tiene (o al revés)
    expectTypeOf<DomainHomeType>().toEqualTypeOf<SharedHomeType>();
  });
});
