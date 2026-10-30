import type { Href } from 'expo-router';

/** Rutas de los matches. */
export const matchRoutes = {
  /** «Explorar», la pestaña de inicio. */
  explore: '/' as Href,
  /** La pestaña «Matches». */
  list: '/matches' as Href,
  /** El detalle de un match (`app/match/[matchId]/index.tsx`), fuera de las pestañas. */
  detail: (matchId: string): Href => `/match/${matchId}`,
  /** El chat de un match (`app/match/[matchId]/chat.tsx`), en la misma pila que su detalle. */
  chat: (matchId: string): Href => `/match/${matchId}/chat`,
} as const;
