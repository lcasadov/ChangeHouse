import type { Href } from 'expo-router';

/** Rutas de los matches. */
export const matchRoutes = {
  /** «Explorar», la pestaña de inicio. */
  explore: '/' as Href,
  /** La pestaña «Matches». */
  list: '/matches' as Href,
  /** El detalle de un match (`app/match/[matchId].tsx`), fuera de las pestañas. */
  detail: (matchId: string): Href => `/match/${matchId}`,
} as const;
