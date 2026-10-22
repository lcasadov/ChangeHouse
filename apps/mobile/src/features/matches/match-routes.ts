import type { Href } from 'expo-router';

/** Rutas de los matches. */
export const matchRoutes = {
  /** «Explorar», la pestaña de inicio. */
  explore: '/' as Href,
  /**
   * Dónde se abre un match concreto. Hasta `add-match-details-and-decisions` no hay pantalla de
   * detalle: lleva a la pestaña «Matches», donde el match nuevo es el primero. Ese change recibirá el
   * identificador del match, apuntará a su pantalla y es el único sitio que hay que tocar.
   */
  detail: (): Href => '/matches',
} as const;
