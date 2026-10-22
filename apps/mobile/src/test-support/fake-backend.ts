import { PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';

import type { Me } from '../features/account/account-api';

export interface RecordedRequest {
  method: string;
  path: string;
  authorization: string | null;
  body: unknown;
}

export function me(overrides: Partial<Me> = {}): Me {
  return {
    id: '0198f3a0-0000-7000-8000-000000000001',
    email: 'ana@example.com',
    displayName: 'Ana',
    roles: ['seeker'],
    meetsVppRequirements: false,
    isOver65: false,
    hasPublishedHome: false,
    ...overrides,
  };
}

const problem = (status: number, extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      type: 'about:blank',
      title: 'Error',
      status,
      correlationId: 'corr-1',
      ...extra,
    }),
    { status, headers: { 'content-type': 'application/problem+json' } },
  );

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type UpsertBody = { displayName: string } & Record<string, unknown>;

/** Como la API: lo omitido no se toca y un municipio en blanco se borra. */
function profileChangesOf(body: UpsertBody): Partial<Me> {
  const changes: Partial<Me> = { displayName: body.displayName };
  if (typeof body['municipality'] === 'string') {
    changes.municipality = body['municipality'] === '' ? null : body['municipality'];
  }
  if (typeof body['phone'] === 'string') changes.phone = body['phone'];
  if (typeof body['meetsVppRequirements'] === 'boolean') {
    changes.meetsVppRequirements = body['meetsVppRequirements'];
  }
  if (typeof body['isOver65'] === 'boolean') changes.isOver65 = body['isOver65'];
  return changes;
}

export type Failure = 'network' | 'server' | 'legal-outdated' | 'unauthorized' | 'invalid';

/**
 * La API en la frontera HTTP: un `fetch` que responde como `docs/api/openapi.yaml` y recuerda
 * cada petición. Mantiene un único usuario: `registered` pasa a `true` tras un `PUT /me` válido.
 */
export class FakeBackend {
  readonly requests: RecordedRequest[] = [];
  registered: boolean;
  failNext: Failure | null = null;
  profile: Me;

  constructor({ registered = false, profile = me() }: { registered?: boolean; profile?: Me } = {}) {
    this.registered = registered;
    this.profile = profile;
  }

  private gate: Promise<void> | null = null;

  /** Retiene la siguiente respuesta hasta llamar a la función devuelta (para probar «en curso»). */
  hold(): () => void {
    let release: () => void = () => undefined;
    this.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    return release;
  }

  readonly fetch = async (input: Request): Promise<Response> => {
    const raw = await input.text();
    const path = new URL(input.url).pathname;
    this.requests.push({
      method: input.method,
      path,
      authorization: input.headers.get('authorization'),
      body: raw === '' ? undefined : (JSON.parse(raw) as unknown),
    });
    const gate = this.gate;
    this.gate = null;
    await gate;
    return this.respond(input.method, path, raw === '' ? undefined : (JSON.parse(raw) as unknown));
  };

  requestsTo(method: string, path: string): RecordedRequest[] {
    return this.requests.filter((request) => request.method === method && request.path === path);
  }

  private respond(method: string, path: string, body: unknown): Response {
    const failure = this.failNext;
    if (failure) {
      this.failNext = null;
      return this.fail(failure);
    }
    if (path !== '/me') return problem(404);
    if (method === 'GET') return this.registered ? json(200, this.profile) : problem(404);
    return this.upsert(body as UpsertBody);
  }

  private upsert(body: UpsertBody): Response {
    const legalOk =
      body['acceptedTermsVersion'] === TERMS_VERSION &&
      body['acceptedPrivacyVersion'] === PRIVACY_VERSION;
    if (!this.registered && !legalOk) return problem(422, { code: 'LEGAL_ACCEPTANCE_REQUIRED' });
    const created = !this.registered;
    this.registered = true;
    this.profile = { ...this.profile, ...profileChangesOf(body) };
    return json(created ? 201 : 200, this.profile);
  }

  private fail(failure: Failure): Response {
    if (failure === 'network') throw new TypeError('Failed to fetch');
    if (failure === 'unauthorized') return problem(401);
    if (failure === 'invalid') {
      return problem(400, { errors: [{ field: 'displayName', message: 'no válido' }] });
    }
    if (failure === 'legal-outdated') return problem(422, { code: 'LEGAL_ACCEPTANCE_REQUIRED' });
    return problem(500);
  }
}
