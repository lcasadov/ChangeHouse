import { useTranslation } from 'react-i18next';

import { EmptyState } from '../../ui';

export interface EndOfFeedProps {
  onWidenZone: () => void;
  onAdjustCompensation: () => void;
}

/** Sin más viviendas compatibles: explica por qué y ofrece lo que sí amplía la búsqueda. */
export function EndOfFeed({ onWidenZone, onAdjustCompensation }: Readonly<EndOfFeedProps>) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon="compass-outline"
      title={t('discovery.end.title')}
      description={t('discovery.end.description')}
      action={{ label: t('discovery.end.widenZone'), onPress: onWidenZone }}
      secondaryAction={{
        label: t('discovery.end.adjustCompensation'),
        onPress: onAdjustCompensation,
      }}
    />
  );
}
