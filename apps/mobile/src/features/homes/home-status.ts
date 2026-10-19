import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { BadgeTone } from '../../ui';
import { firstIncompleteStep, type WizardStep } from './home-form';
import type { Home } from './homes-api';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Cómo se muestra cada `HomeStatus`: siempre texto (i18n) e icono, nunca solo color. */
export const STATUS_PRESENTATION: Record<Home['status'], { tone: BadgeTone; icon: IconName }> = {
  draft: { tone: 'neutral', icon: 'create-outline' },
  in_review: { tone: 'info', icon: 'time-outline' },
  published: { tone: 'success', icon: 'checkmark-circle' },
  paused: { tone: 'warning', icon: 'pause-circle' },
  in_operation: { tone: 'info', icon: 'swap-horizontal' },
  closed: { tone: 'neutral', icon: 'lock-closed' },
};

export type PrimaryAction =
  /** Un borrador con datos por rellenar: sigue el asistente donde se dejó. */
  | { kind: 'continue'; step: WizardStep }
  /** Un borrador completo: a la revisión final, donde está el envío. */
  | { kind: 'submit'; step: WizardStep }
  /** Cualquier otro estado: consultar la ficha. */
  | { kind: 'view' };

const REVIEW_STEP: WizardStep = 5;

/** La acción principal de una tarjeta de «Mis casas» según el estado y lo que falta. */
export function primaryActionOf(home: Home): PrimaryAction {
  if (home.status !== 'draft') return { kind: 'view' };
  const step = firstIncompleteStep(home);
  return step === REVIEW_STEP ? { kind: 'submit', step } : { kind: 'continue', step };
}
