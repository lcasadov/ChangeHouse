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
const HOME_OWNER_ROLES: readonly Role[] = ['seeker', 'owner'];

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
  // Viviendas: `agency` y `admin` no publican ni gestionan viviendas propias (RC-19); la propiedad
  // de cada vivienda (`resourceOwner`) y su visibilidad las resuelve el caso de uso con un 404
  listMyHomes: { kind: 'roles', roles: HOME_OWNER_ROLES },
  createHome: { kind: 'roles', roles: HOME_OWNER_ROLES },
  updateHome: { kind: 'roles', roles: HOME_OWNER_ROLES },
  submitHome: { kind: 'roles', roles: HOME_OWNER_ROLES },
  // Fotos: mismas reglas que la vivienda a la que pertenecen (la propiedad la resuelve el caso de uso)
  createHomePhotoUpload: { kind: 'roles', roles: HOME_OWNER_ROLES },
  completeHomePhotoUpload: { kind: 'roles', roles: HOME_OWNER_ROLES },
  deleteHomePhoto: { kind: 'roles', roles: HOME_OWNER_ROLES },
  // El admin consulta viviendas ajenas en su forma pública; la ficha para moderar sale de adminListHomes
  getHome: { kind: 'roles', roles: [...HOME_OWNER_ROLES, 'admin'] },
  // Preferencias de búsqueda (RF-30 a RF-33): mismos roles que las viviendas; el ámbito propio y la
  // propiedad de la vivienda (`resourceOwner`) los resuelve el caso de uso con un 404
  getMySearchPreferences: { kind: 'roles', roles: HOME_OWNER_ROLES },
  putMySearchPreferences: { kind: 'roles', roles: HOME_OWNER_ROLES },
  getHomeSearchPreferences: { kind: 'roles', roles: HOME_OWNER_ROLES },
  putHomeSearchPreferences: { kind: 'roles', roles: HOME_OWNER_ROLES },
  deleteHomeSearchPreferences: { kind: 'roles', roles: HOME_OWNER_ROLES },
  // Descubrimiento (RF-40): owner y seeker; la vivienda desde la que se busca (propia y publicada)
  // la resuelve el caso de uso con un 404
  discoverHomes: { kind: 'roles', roles: HOME_OWNER_ROLES },
  // Moderación (RF-18, RF-93): solo el admin; la decisión queda auditada
  adminListHomes: { kind: 'roles', roles: ['admin'] },
  adminModerateHome: { kind: 'roles', roles: ['admin'] },
};

/** Único punto de decisión: ¿puede este actor invocar una operación con este acceso? */
export function decide(access: Access, actor: Actor): Decision {
  if (access.kind !== 'roles') return { allowed: true };
  if (actor !== 'unregistered' && access.roles.includes(actor)) return { allowed: true };
  return { allowed: false, status: access.denyStatus ?? 403 };
}
