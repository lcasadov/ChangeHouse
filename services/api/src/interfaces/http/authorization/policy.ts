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
  /**
   * Solo los roles listados; quien aún no tiene cuenta nunca figura en la lista. Una cuenta
   * suspendida se deniega salvo que la operación lo admita expresamente (`allowSuspended`).
   */
  | { kind: 'roles'; roles: readonly Role[]; denyStatus?: DenyStatus; allowSuspended?: true };

/** Reglas por `operationId` del contrato (`docs/api/openapi.yaml`). Lo que no figura se deniega. */
export type Policy = Readonly<Record<string, Access>>;

/** Código estable de la denegación a una cuenta suspendida (`docs/rbac-matrix.md` §6). */
export const ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED';

export type Decision =
  { allowed: true } | { allowed: false; status: DenyStatus; code?: typeof ACCOUNT_SUSPENDED };

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
  // `self`: sin cuenta no hay nada que consultar, y no se distingue de un recurso inexistente. Es
  // la única operación que admite una cuenta suspendida: la app la usa para mostrar la suspensión
  // (`exportMyData`, que también la admitirá según la matriz, aún no está implementada)
  getMe: { kind: 'roles', roles: ALL_ACCOUNT_ROLES, denyStatus: 404, allowSuspended: true },
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
  // Decisiones (RF-41, RF-44, RF-45): el me gusta exige una vivienda publicada propia (RN-01), es decir,
  // el rol `owner`; descartar y deshacer también las puede hacer un `seeker` desde su cuenta. La
  // propiedad de `fromHomeId` y del destino las resuelve el caso de uso con un 404
  likeHome: { kind: 'roles', roles: ['owner'] },
  dismissHome: { kind: 'roles', roles: HOME_OWNER_ROLES },
  undoLastAction: { kind: 'roles', roles: HOME_OWNER_ROLES },
  // Matches (RF-50): los propios. También un `seeker`, que puede tenerlos si pausó su vivienda; sin
  // matches ve la lista vacía. Que solo vea los suyos lo resuelve el caso de uso
  listMyMatches: { kind: 'roles', roles: HOME_OWNER_ROLES },
  // Detalle, confirmación, retirada y teléfono (RF-53, RF-54): el detalle también lo consulta el admin
  // (sin teléfonos ni direcciones exactas); el resto son de participantes. La pertenencia al match
  // (`participant`) la resuelve el caso de uso con un 404, sin revelar que existe
  getMatch: { kind: 'roles', roles: [...HOME_OWNER_ROLES, 'admin'] },
  confirmMatch: { kind: 'roles', roles: HOME_OWNER_ROLES },
  withdrawFromMatch: { kind: 'roles', roles: HOME_OWNER_ROLES },
  setPhoneSharing: { kind: 'roles', roles: HOME_OWNER_ROLES },
  // Moderación (RF-18, RF-93): solo el admin; la decisión queda auditada
  adminListHomes: { kind: 'roles', roles: ['admin'] },
  adminModerateHome: { kind: 'roles', roles: ['admin'] },
  // Suspensión de usuarios (RF-90, RF-93): solo el admin; la decisión queda auditada
  adminSetUserSuspension: { kind: 'roles', roles: ['admin'] },
};

/**
 * Único punto de decisión: ¿puede este actor invocar una operación con este acceso? Una cuenta
 * suspendida solo pasa por las operaciones públicas y por las que la admiten expresamente.
 */
export function decide(access: Access, actor: Actor, suspended = false): Decision {
  if (access.kind === 'public') return { allowed: true };
  const admitsSuspended = access.kind === 'roles' && access.allowSuspended === true;
  if (suspended && !admitsSuspended) {
    return { allowed: false, status: 403, code: ACCOUNT_SUSPENDED };
  }
  if (access.kind === 'authenticated') return { allowed: true };
  if (actor !== 'unregistered' && access.roles.includes(actor)) return { allowed: true };
  return { allowed: false, status: access.denyStatus ?? 403 };
}
