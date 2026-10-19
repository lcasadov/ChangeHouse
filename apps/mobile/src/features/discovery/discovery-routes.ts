import type { Href } from 'expo-router';

/** Rutas bajo «Explorar» (`app/discover`). */
export const discoveryRoutes = {
  /** El detalle de una vivienda ajena. */
  detail: (homeId: string): Href => `/discover/${homeId}`,
} as const;
