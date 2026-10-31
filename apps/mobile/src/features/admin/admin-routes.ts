import type { Href } from 'expo-router';

/** Rutas de la pestaña «Administración» (`app/(tabs)/admin`). */
export const adminRoutes = {
  queue: '/admin',
  /** Suspender o reactivar a un usuario por su identificador (sin listado hasta `add-admin-panel`). */
  users: '/admin/users',
  reports: '/admin/reports',
  detail: (homeId: string): Href => `/admin/${homeId}`,
} as const;
