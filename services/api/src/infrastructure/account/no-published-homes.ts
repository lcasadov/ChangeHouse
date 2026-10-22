import type { HomeOwnership } from '../../application/account/home-ownership.js';

/**
 * Implementación provisional: todavía no hay viviendas, así que nadie tiene una publicada y
 * todos los usuarios con cuenta son `seeker`. `add-home-listing` la sustituye por la consulta real.
 */
export const noPublishedHomes: HomeOwnership = {
  hasPublishedHome: () => Promise.resolve(false),
};
