/**
 * Puerto de salida: ¿tiene el usuario alguna vivienda publicada, pausada o en operación?
 * De ahí se derivan `owner` y `seeker` (`docs/rbac-matrix.md` §1).
 */
export interface HomeOwnership {
  hasPublishedHome(userId: string): Promise<boolean>;
}
