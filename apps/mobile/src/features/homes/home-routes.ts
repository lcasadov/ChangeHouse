import type { Href } from 'expo-router';

import type { WizardStep } from './home-form';

/** Rutas de la pestaña «Mis casas» (`app/(tabs)/homes`). */
export const homeRoutes = {
  list: '/homes',
  create: '/homes/new',
  detail: (homeId: string): Href => `/homes/${homeId}`,
  /** El asistente de una vivienda; sin `step` abre el primer paso incompleto. */
  edit: (homeId: string, step?: WizardStep): Href =>
    step ? `/homes/${homeId}/edit?step=${String(step)}` : `/homes/${homeId}/edit`,
} as const;
