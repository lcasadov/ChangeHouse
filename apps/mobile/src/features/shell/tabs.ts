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

/** «Administración» sustituye a «Mis casas» para el rol `admin`, que no publica viviendas. */
const ADMIN_TAB: TabDefinition = {
  route: 'admin',
  section: 'admin',
  icon: { active: 'shield-checkmark', inactive: 'shield-checkmark-outline' },
};

/** Las pestañas que ve la persona: las cuatro de siempre o, si es admin, con «Administración». */
export function tabsFor(isAdmin: boolean): readonly TabDefinition[] {
  return isAdmin ? TABS.map((tab) => (tab.section === 'homes' ? ADMIN_TAB : tab)) : TABS;
}

/** La ruta que existe pero no se ofrece como pestaña a esta persona. */
export function hiddenTabRoute(isAdmin: boolean): string {
  return isAdmin ? 'homes' : ADMIN_TAB.route;
}

export type NavigationLayout = 'bottom' | 'side';

/** Barra lateral solo en web ancha (`expanded`); en el resto, pestañas inferiores. */
export function navigationLayoutFor(os: string, breakpoint: Breakpoint): NavigationLayout {
  return os === 'web' && breakpoint === 'expanded' ? 'side' : 'bottom';
}
