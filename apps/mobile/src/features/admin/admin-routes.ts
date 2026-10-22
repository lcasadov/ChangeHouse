import type { Href } from 'expo-router';

/** Rutas de la pestaña «Administración» (`app/(tabs)/admin`). */
export const adminRoutes = {
  queue: '/admin',
  detail: (homeId: string): Href => `/admin/${homeId}`,
} as const;
