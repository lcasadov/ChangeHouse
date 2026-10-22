import { FIXTURE_PLACES, PRIVACY_VERSION, TERMS_VERSION } from '@changehouse/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { emulatorAvailable, type EmulatorUser, signUp } from '../../../../test/auth-emulator.js';
import { openSql, testConfig } from '../../../../test/fixtures.js';
import { createApi } from '../../../bootstrap.js';

const MALASANA = FIXTURE_PLACES[0]!;
const ADDRESS = { placeId: MALASANA.placeId, formatted: MALASANA.formatted };
const COMPLETE = {
  usefulM2: 80,
  builtM2: 95,
  bedrooms: 3,
  bathrooms: 2,
  hasLift: true,
  garage: false,
  storageRoom: false,
  valueMinCents: 250_000_00,
  valueMaxCents: 280_000_00,
  isPrimaryResidence: true,
};
const MISSING_ID = '0199c1a2-0000-7000-8000-000000000000';

const sql = openSql();
let app: FastifyInstance;
let close: () => Promise<void>;

const bearer = (user: Pick<EmulatorUser, 'idToken'>) => ({
  authorization: `Bearer ${user.idToken}`,
});

type Json = Record<string, unknown>;

function call(user: EmulatorUser, method: 'GET' | 'POST', url: string, payload?: object) {
  return app.inject({
    method,
    url,
    headers: bearer(user),
    ...(payload ? { payload } : {}),
  });
}

/** Persona con cuenta en Firebase y dada de alta en ChangeHouse; con `admin` se le asigna el rol. */
async function registered(assignedRole?: 'agency' | 'admin'): Promise<EmulatorUser> {
  const user = await signUp();
  const response = await app.inject({
    method: 'PUT',
    url: '/v1/me',
    headers: bearer(user),
    payload: {
      displayName: 'Ana',
      acceptedTermsVersion: TERMS_VERSION,
      acceptedPrivacyVersion: PRIVACY_VERSION,
    },
  });
  expect(response.statusCode).toBe(201);
  if (assignedRole) {
    await sql`UPDATE users SET assigned_role = ${assignedRole} WHERE firebase_uid = ${user.uid}`;
  }
  return user;
}

async function addReadyPhotos(homeId: string, count = 3): Promise<void> {
  for (let position = 1; position <= count; position += 1) {
    const id = crypto.randomUUID();
    await sql`INSERT INTO home_photos (id, home_id, status, storage_path, position)
              VALUES (${id}, ${homeId}, 'ready', ${`homes/${homeId}/${id}.webp`}, ${position})`;
  }
}

/** Una vivienda completa de un propietario nuevo, con fotos; enviada a revisión por la API salvo `draft`. */
async function homeInReview(
  options: { submittedAt?: string; submit?: boolean } = {},
): Promise<{ owner: EmulatorUser; homeId: string }> {
  const owner = await registered();
  const created = await call(owner, 'POST', '/v1/homes', {
    type: 'piso',
    address: ADDRESS,
    ...COMPLETE,
  });
  expect(created.statusCode, created.body).toBe(201);
  const homeId = created.json<{ id: string }>().id;
  await addReadyPhotos(homeId);
  if (options.submit !== false) {
    const submitted = await call(owner, 'POST', `/v1/homes/${homeId}/submit`);
    expect(submitted.statusCode, submitted.body).toBe(200);
    if (options.submittedAt) {
      await sql`UPDATE homes SET submitted_at = ${options.submittedAt} WHERE id = ${homeId}`;
    }
  }
  return { owner, homeId };
}

const statusOf = async (homeId: string) =>
  (await sql<{ status: string }[]>`SELECT status FROM homes WHERE id = ${homeId}`)[0]?.status;

beforeAll(() => {
  ({ app, close } = createApi(testConfig()));
});

beforeEach(async () => {
  await sql`TRUNCATE users CASCADE`;
});

afterAll(async () => {
  await close();
  await sql.end();
});

describe.skipIf(!emulatorAvailable())('moderación de viviendas con tokens reales', () => {
  describe('adminListHomes', () => {
    it('Scenario: Ver la cola - un admin ve primero la enviada antes, con su ficha y sus fotos, sin la dirección exacta', async () => {
      const admin = await registered('admin');
      const newer = await homeInReview({ submittedAt: '2026-10-12T08:00:00Z' });
      const older = await homeInReview({ submittedAt: '2026-10-10T08:00:00Z' });
      await homeInReview({ submit: false });

      const response = await call(admin, 'GET', '/v1/admin/homes?status=in_review');

      expect(response.statusCode, response.body).toBe(200);
      const page = response.json<{ items: Json[]; nextCursor: string | null }>();
      expect(page.items.map((item) => item['id'])).toEqual([older.homeId, newer.homeId]);
      expect(page.nextCursor).toBeNull();
      expect(page.items[0]).toMatchObject({
        status: 'in_review',
        type: 'piso',
        address: 'Malasaña',
        photos: [{ position: 1 }, { position: 2 }, { position: 3 }],
        ...COMPLETE,
      });
      expect(response.body).not.toContain('Calle del Pez');
    });

    it('Scenario: Cola vacía - sin viviendas en revisión responde 200 con items vacío', async () => {
      const admin = await registered('admin');
      await homeInReview({ submit: false });

      const response = await call(admin, 'GET', '/v1/admin/homes?status=in_review');

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ items: [], nextCursor: null });
    });

    it('pagina con limit y cursor sin saltar ni repetir viviendas', async () => {
      const admin = await registered('admin');
      const first = await homeInReview({ submittedAt: '2026-10-10T08:00:00Z' });
      const second = await homeInReview({ submittedAt: '2026-10-11T08:00:00Z' });
      const third = await homeInReview({ submittedAt: '2026-10-12T08:00:00Z' });

      const page1 = (await call(admin, 'GET', '/v1/admin/homes?status=in_review&limit=2')).json<{
        items: Json[];
        nextCursor: string;
      }>();
      const page2 = (
        await call(
          admin,
          'GET',
          `/v1/admin/homes?status=in_review&limit=2&cursor=${page1.nextCursor}`,
        )
      ).json<{ items: Json[]; nextCursor: string | null }>();

      expect(page1.items.map((item) => item['id'])).toEqual([first.homeId, second.homeId]);
      expect(page2.items.map((item) => item['id'])).toEqual([third.homeId]);
      expect(page2.nextCursor).toBeNull();
    });

    it('sin estado lista todas las viviendas, también las que no están en revisión', async () => {
      const admin = await registered('admin');
      const draft = await homeInReview({ submit: false });
      const queued = await homeInReview();

      const response = await call(admin, 'GET', '/v1/admin/homes');

      const ids = response.json<{ items: Json[] }>().items.map((item) => item['id']);
      expect(ids).toHaveLength(2);
      expect(ids).toEqual(expect.arrayContaining([draft.homeId, queued.homeId]));
    });

    it.each(['seeker', 'owner', 'agency'] as const)(
      'Scenario: Usuario sin rol de administración - %s recibe 403',
      async (kind) => {
        const user = await registered(kind === 'agency' ? 'agency' : undefined);
        if (kind === 'owner') {
          const { owner, homeId } = await homeInReview();
          await sql`UPDATE homes SET status = 'published' WHERE id = ${homeId}`;
          const me = await call(owner, 'GET', '/v1/me');
          expect(me.json()).toMatchObject({ roles: ['owner'] });
          expect((await call(owner, 'GET', '/v1/admin/homes')).statusCode).toBe(403);
          return;
        }

        const response = await call(user, 'GET', '/v1/admin/homes?status=in_review');

        expect(response.statusCode).toBe(403);
      },
    );

    it('una consulta mal formada es un 400', async () => {
      const admin = await registered('admin');

      expect((await call(admin, 'GET', '/v1/admin/homes?status=xx')).statusCode).toBe(400);
      expect((await call(admin, 'GET', '/v1/admin/homes?cursor=basura')).statusCode).toBe(400);
    });
  });

  describe('adminModerateHome', () => {
    it('Scenario: Aprobar - pasa a published, su propietario pasa a tener el rol owner y la decisión queda auditada', async () => {
      const admin = await registered('admin');
      const { owner, homeId } = await homeInReview();

      const response = await call(admin, 'POST', `/v1/admin/homes/${homeId}/moderation`, {
        decision: 'approve',
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json()).toMatchObject({
        id: homeId,
        status: 'published',
        moderationNote: null,
        address: 'Malasaña',
        photos: [{}, {}, {}],
      });
      expect(await statusOf(homeId)).toBe('published');
      expect((await call(owner, 'GET', '/v1/me')).json()).toMatchObject({ roles: ['owner'] });
      const audit = await sql<
        { action: string; entity: string; entity_id: string; actor: string }[]
      >`
        SELECT a.action, a.entity, a.entity_id, u.firebase_uid AS actor
        FROM audit_log a JOIN users u ON u.id = a.actor_id`;
      expect(audit).toEqual([
        { action: 'home.approve', entity: 'home', entity_id: homeId, actor: admin.uid },
      ]);
    });

    it('Scenario: Rechazar con motivo - vuelve a draft y el propietario ve el motivo en Mis casas; en la auditoría no se guarda el motivo', async () => {
      const admin = await registered('admin');
      const { owner, homeId } = await homeInReview();
      const reason = 'Las fotos no corresponden a la vivienda';

      const response = await call(admin, 'POST', `/v1/admin/homes/${homeId}/moderation`, {
        decision: 'reject',
        reason,
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json()).toMatchObject({ status: 'draft', moderationNote: reason });
      const mine = await call(owner, 'GET', '/v1/me/homes');
      expect(mine.json<Json[]>()[0]).toMatchObject({ status: 'draft', moderationNote: reason });
      expect(JSON.stringify(await sql`SELECT * FROM audit_log`)).not.toContain('fotos');
    });

    it('el motivo se conserva al volver a enviar y se limpia al aprobar; la vista pública nunca lo lleva', async () => {
      const admin = await registered('admin');
      const { owner, homeId } = await homeInReview();
      await call(admin, 'POST', `/v1/admin/homes/${homeId}/moderation`, {
        decision: 'reject',
        reason: 'Fotos borrosas',
      });

      const resubmitted = await call(owner, 'POST', `/v1/homes/${homeId}/submit`);
      const approved = await call(admin, 'POST', `/v1/admin/homes/${homeId}/moderation`, {
        decision: 'approve',
      });
      const seeker = await registered();
      const publicView = await call(seeker, 'GET', `/v1/homes/${homeId}`);

      expect(resubmitted.json()).toMatchObject({
        status: 'in_review',
        moderationNote: 'Fotos borrosas',
      });
      expect(approved.json()).toMatchObject({ status: 'published', moderationNote: null });
      expect(publicView.statusCode).toBe(200);
      expect(publicView.json()).not.toHaveProperty('moderationNote');
    });

    it('Scenario: Rechazar sin motivo - 400, la vivienda sigue en revisión y no se audita', async () => {
      const admin = await registered('admin');
      const { homeId } = await homeInReview();

      for (const payload of [{ decision: 'reject' }, { decision: 'reject', reason: '  ' }]) {
        const response = await call(admin, 'POST', `/v1/admin/homes/${homeId}/moderation`, payload);

        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({ errors: [{ field: 'reason' }] });
      }
      expect(await statusOf(homeId)).toBe('in_review');
      expect(await sql`SELECT 1 FROM audit_log`).toHaveLength(0);
    });

    it.each(['draft', 'published', 'paused'] as const)(
      'Scenario: Moderar algo que no está en revisión - una vivienda en %s da 409 y no se audita',
      async (status) => {
        const admin = await registered('admin');
        const { homeId } = await homeInReview({ submit: false });
        await sql`UPDATE homes SET status = ${status}::home_status WHERE id = ${homeId}`;

        const approve = await call(admin, 'POST', `/v1/admin/homes/${homeId}/moderation`, {
          decision: 'approve',
        });
        const reject = await call(admin, 'POST', `/v1/admin/homes/${homeId}/moderation`, {
          decision: 'reject',
          reason: 'x',
        });

        expect(approve.statusCode).toBe(409);
        expect(reject.statusCode).toBe(409);
        expect(approve.json()).toMatchObject({ code: 'HOME_NOT_IN_REVIEW' });
        expect(await statusOf(homeId)).toBe(status);
        expect(await sql`SELECT 1 FROM audit_log`).toHaveLength(0);
      },
    );

    it('una vivienda inexistente o un id que no es UUID es un 404', async () => {
      const admin = await registered('admin');

      const missing = await call(admin, 'POST', `/v1/admin/homes/${MISSING_ID}/moderation`, {
        decision: 'approve',
      });
      const malformed = await call(admin, 'POST', '/v1/admin/homes/xx/moderation', {
        decision: 'approve',
      });

      expect(missing.statusCode).toBe(404);
      expect(malformed.statusCode).toBe(404);
    });

    it('Scenario: Usuario sin rol de administración - un propietario o un buscador reciben 403 y la vivienda no cambia', async () => {
      const { owner, homeId } = await homeInReview();
      const seeker = await registered();

      for (const user of [owner, seeker]) {
        const response = await call(user, 'POST', `/v1/admin/homes/${homeId}/moderation`, {
          decision: 'approve',
        });

        expect(response.statusCode).toBe(403);
      }
      expect(await statusOf(homeId)).toBe('in_review');
    });

    it('Scenario: Sin auditoría no hay decisión - si la entrada de auditoría falla, 500 Problem y la vivienda sigue en in_review', async () => {
      const admin = await registered('admin');
      const { homeId } = await homeInReview();
      await sql.unsafe(`
        CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $f$
        BEGIN RAISE EXCEPTION 'fallo simulado de auditoria'; END; $f$`);
      await sql.unsafe(
        'CREATE TRIGGER fail_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_audit()',
      );

      try {
        const response = await call(admin, 'POST', `/v1/admin/homes/${homeId}/moderation`, {
          decision: 'approve',
        });

        expect(response.statusCode).toBe(500);
        expect(response.headers['content-type']).toContain('application/problem+json');
        expect(response.body).not.toContain('auditoria');
      } finally {
        await sql.unsafe('DROP TRIGGER fail_audit ON audit_log');
        await sql.unsafe('DROP FUNCTION fail_audit()');
      }
      expect(await statusOf(homeId)).toBe('in_review');
      expect(await sql`SELECT 1 FROM audit_log`).toHaveLength(0);
    });

    it('dos admins que moderan a la vez: uno recibe 200, el otro 409, y solo hay una entrada de auditoría', async () => {
      const first = await registered('admin');
      const second = await registered('admin');
      const { homeId } = await homeInReview();

      const responses = await Promise.all([
        call(first, 'POST', `/v1/admin/homes/${homeId}/moderation`, { decision: 'approve' }),
        call(second, 'POST', `/v1/admin/homes/${homeId}/moderation`, {
          decision: 'reject',
          reason: 'Fotos borrosas',
        }),
      ]);

      expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
      expect(await sql`SELECT 1 FROM audit_log`).toHaveLength(1);
    });
  });
});
