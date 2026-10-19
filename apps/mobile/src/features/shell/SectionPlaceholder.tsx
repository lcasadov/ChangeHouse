import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '../../ui';

export type Section = 'explore' | 'matches' | 'homes' | 'profile';

/** Las secciones que aún no tienen feature propia: el perfil y «Mis casas» ya no son provisionales. */
export type PlaceholderSection = Exclude<Section, 'profile' | 'homes'>;

export interface SectionPlaceholderProps {
  section: PlaceholderSection;
  icon: ComponentProps<typeof EmptyState>['icon'];
}

/** Pantalla provisional de una sección: explica qué habrá en ella hasta que exista la feature. */
export function SectionPlaceholder({ section, icon }: Readonly<SectionPlaceholderProps>) {
  const { t } = useTranslation();
  return (
    <Screen>
      <EmptyState
        icon={icon}
        title={t(`${section}.empty.title`)}
        description={t(`${section}.empty.description`)}
      />
    </Screen>
  );
}
