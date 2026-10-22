import type { Role } from '../../../domain/account/role.js';

/** Quién hace la petición para la política: un rol con cuenta, o una identidad aún sin alta. */
export type Actor = Role | 'unregistered';

/** Respuesta con la que se deniega: 403 si la existencia de la operación no es secreta; 404 si no se revela. */
export type DenyStatus = 403 | 404;

export type Access =
  /** Sin token (`visitor`). La única operación pública es `joinWaitlist`. */
  | { kind: 'public' }
  /** Cualquier identidad verificada, esté o no dada de alta. */
  | { kind: 'authenticated' }
  /** Solo los roles listados; quien aún no tiene cuenta nunca figura en la lista. */
  | { kind: 'roles'; roles: readonly Role[]; denyStatus?: DenyStatus };

/** Reglas por `operationId` del contrato (`docs/api/openapi.yaml`). Lo que no figura se deniega. */
export type Policy = Readonly<Record<string, Access>>;

export type Decision = { allowed: true } | { allowed: false; status: DenyStatus };

const ALL_ACCOUNT_ROLES: readonly Role[] = ['seeker', 'owner', 'agency', 'admin'];

/**
 * Política de autorización como datos (`docs/rbac-matrix.md` §5). Cada change que añade una
 * operación añade aquí su regla y sus filas en `test/authorization/rbac-matrix.json`.
 */
export const policy: Policy = {
  joinWaitlist: { kind: 'public' },
  // `self`: cualquier usuario autenticado, también sin alta previa (es lo que crea la cuenta)
  upsertMe: { kind: 'authenticated' },
  // `self`: sin cuenta no hay nada que consultar, y no se distingue de un recurso inexistente
  getMe: { kind: 'roles', roles: ALL_ACCOUNT_ROLES, denyStatus: 404 },
  listMyConsents: { kind: 'roles', roles: ALL_ACCOUNT_ROLES, denyStatus: 404 },
  acceptConsent: { kind: 'roles', roles: ALL_ACCOUNT_ROLES, denyStatus: 404 },
};

/** Único punto de decisión: ¿puede este actor invocar una operación con este acceso? */
export function decide(access: Access, actor: Actor): Decision {
  if (access.kind !== 'roles') return { allowed: true };
  if (actor !== 'unregistered' && access.roles.includes(actor)) return { allowed: true };
  return { allowed: false, status: access.denyStatus ?? 403 };
}
