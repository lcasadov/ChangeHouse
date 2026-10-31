import type { Href } from 'expo-router';

/** Rutas de la pestaña «Administración» (`app/(tabs)/admin`). */
export const adminRoutes = {
  queue: '/admin',
  reports: '/admin/reports',
  users: '/admin/users',
  metrics: '/admin/metrics',
  audit: '/admin/audit',
  waitlist: '/admin/waitlist',
  /** Suspender o reactivar a un usuario ya elegido en el listado. */
  suspension: (userId: string): Href => ({
    pathname: '/admin/user-suspension',
    params: { userId },
  }),
  detail: (homeId: string): Href => `/admin/${homeId}`,
} as const;
