import { useTheme } from '@changehouse/ui';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Text } from '../../ui';
import type { WizardStep } from './home-form';
import type { Home } from './homes-api';
import { HomeSummary } from './HomeSummary';
import { SubmitAction } from './SubmitAction';

export interface ReviewStepProps {
  home: Home;
  onSubmitted: (home: Home) => void;
  onComplete: (step: WizardStep) => void;
  onBack: () => void;
  onExit: () => void;
}

/** Paso 5, revisión: el resumen de lo guardado y el envío a revisión. */
export function ReviewStep({
  home,
  onSubmitted,
  onComplete,
  onBack,
  onExit,
}: Readonly<ReviewStepProps>) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space[4] }}>
      <Text tone="textMuted">{t('homes.review.description')}</Text>
      <HomeSummary home={home} />
      <SubmitAction home={home} onSubmitted={onSubmitted} onComplete={onComplete} />
      <Button variant="secondary" label={t('homes.wizard.back')} onPress={onBack} />
      <Button variant="ghost" label={t('homes.wizard.exit')} onPress={onExit} />
    </View>
  );
}
