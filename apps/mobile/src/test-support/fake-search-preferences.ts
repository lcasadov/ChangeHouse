import { validateSearchPreferences } from '@changehouse/shared';

import type { SearchPreferences } from '../features/search/search-preferences-api';
import type { FakeHomes } from './fake-homes';
import { json, problem } from './http-responses';

const HOME_PREFERENCES = /^\/homes\/([^/]+)\/search-preferences$/;
const MY_PREFERENCES = '/me/search-preferences';

/** Un rechazo preparado para la siguiente escritura, con la forma del `Problem` del contrato. */
interface Rejection {
  status: number;
  extra: Record<string, unknown>;
}

/**
 * Las preferencias de búsqueda con las reglas de la API (`docs/api/openapi.yaml`): forma validada con
 * el mismo esquema Zod compartido (400), zona obligatoria (422), reemplazo del documento entero y
 * vivienda ajena o inexistente (404).
 */
export class FakeSearchPreferences {
  /** Las del usuario, o `null` mientras no las haya guardado. */
  mine: SearchPreferences | null;
  /** Las propias de cada vivienda, por identificador. */
  readonly byHome = new Map<string, SearchPreferences>();
  private rejection: Rejection | null = null;
  private readRejection: number | null = null;

  constructor(
    private readonly homes: FakeHomes,
    mine: SearchPreferences | null,
  ) {
    this.mine = mine;
  }

  /** La siguiente escritura (`PUT`) responde con este error en lugar de guardar. */
  rejectNextPut(status: number, extra: Record<string, unknown> = {}): void {
    this.rejection = { status, extra };
  }

  /** La siguiente lectura (`GET`) responde con este error. */
  rejectNextGet(status: number): void {
    this.readRejection = status;
  }

  respond(method: string, path: string, body: unknown): Response {
    if (method === 'GET' && this.readRejection !== null) {
      const status = this.readRejection;
      this.readRejection = null;
      return problem(status);
    }
    if (path === MY_PREFERENCES) {
      return method === 'GET'
        ? this.read(this.mine)
        : this.write(body, (saved) => {
            this.mine = saved;
          });
    }

    const homeId = HOME_PREFERENCES.exec(path)?.[1] ?? '';
    if (!this.homes.all().some((home) => home.id === homeId)) return problem(404);
    if (method === 'GET') return this.read(this.byHome.get(homeId) ?? null);
    if (method === 'DELETE') {
      return this.byHome.delete(homeId) ? new Response(null, { status: 204 }) : problem(404);
    }
    return this.write(body, (saved) => {
      this.byHome.set(homeId, saved);
    });
  }

  private read(preferences: SearchPreferences | null): Response {
    return preferences ? json(200, preferences) : problem(404);
  }

  private write(body: unknown, store: (saved: SearchPreferences) => void): Response {
    const rejection = this.rejection;
    if (rejection) {
      this.rejection = null;
      return problem(rejection.status, rejection.extra);
    }
    const result = validateSearchPreferences(body);
    if (!result.success) {
      return problem(400, {
        errors: result.errors.map(({ field, code }) => ({ field, message: code })),
      });
    }
    const saved = result.data;
    const hasZone =
      (saved.municipalities?.length ?? 0) > 0 ||
      (saved.center !== undefined && saved.radiusKm !== undefined);
    if (!hasZone) {
      return problem(422, {
        code: 'SEARCH_PREFERENCES_INCOMPLETE',
        errors: [{ field: 'municipalities', message: 'required' }],
      });
    }
    const stored = { ...saved, filters: saved.filters ?? {} };
    store(stored);
    return json(200, stored);
  }
}
