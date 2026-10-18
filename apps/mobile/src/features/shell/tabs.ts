import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { Breakpoint } from '../../ui';
import type { Section } from './SectionPlaceholder';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface TabDefinition {
  /** Nombre de la ruta de Expo Router dentro de `(tabs)`. */
  route: string;
  section: Section;
  icon: { active: IconName; inactive: IconName };
}

/** Las cuatro secciones de `docs/style-guide.md` §0 «Navegación», en orden. */
export const TABS: readonly TabDefinition[] = [
  { route: 'index', section: 'explore', icon: { active: 'compass', inactive: 'compass-outline' } },
  { route: 'matches', section: 'matches', icon: { active: 'heart', inactive: 'heart-outline' } },
  { route: 'homes', section: 'homes', icon: { active: 'home', inactive: 'home-outline' } },
  { route: 'profile', section: 'profile', icon: { active: 'person', inactive: 'person-outline' } },
];

export type NavigationLayout = 'bottom' | 'side';

/** Barra lateral solo en web ancha (`expanded`); en el resto, pestañas inferiores. */
export function navigationLayoutFor(os: string, breakpoint: Breakpoint): NavigationLayout {
  return os === 'web' && breakpoint === 'expanded' ? 'side' : 'bottom';
}
