import access from '../../assets/ambient/acceso.jpg';
import welcome1 from '../../assets/ambient/bienvenida-1.jpg';
import welcome2 from '../../assets/ambient/bienvenida-2.jpg';
import welcome3 from '../../assets/ambient/bienvenida-3.jpg';
import emptyHomes from '../../assets/ambient/vacio-casas.jpg';
import emptyExplore from '../../assets/ambient/vacio-explorar.jpg';
import emptyMatches from '../../assets/ambient/vacio-matches.jpg';

/** Imagen empaquetada con la app (el identificador de recurso de Metro). */
export type AmbientSource = number;

/**
 * Fotografía de ambiente de la app (generada con `pnpm media:generate`): la bienvenida, el acceso y
 * los estados vacíos. Siempre decorativa.
 */
export const AMBIENT = {
  welcome: [welcome1, welcome2, welcome3],
  access,
  emptyExplore,
  emptyMatches,
  emptyHomes,
} as const;
