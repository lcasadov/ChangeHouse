import { useTheme } from '@changehouse/ui';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Notice } from '../../ui';
import type { SaveFailure } from './use-step-submit';

export interface StepActionsProps {
  /** Guardando: el botón principal queda bloqueado y anuncia que está ocupado. */
  saving: boolean;
  /** Fallo al guardar el paso, explicado junto a las acciones. */
  failure?: SaveFailure | null;
  onNext: () => void;
  /** Ausente en el primer paso. */
  onBack?: (() => void) | undefined;
  onExit: () => void;
}

/** Acciones comunes de un paso: guardar y continuar, volver al anterior y salir con el borrador guardado. */
export function StepActions({
  saving,
  failure,
  onNext,
  onBack,
  onExit,
}: Readonly<StepActionsProps>) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space[3] }}>
      {failure ? <Notice tone="danger">{t(`homes.errors.${failure}`)}</Notice> : null}
      <Button label={t('homes.wizard.next')} loading={saving} onPress={onNext} />
      {onBack ? (
        <Button variant="secondary" label={t('homes.wizard.back')} onPress={onBack} />
      ) : null}
      <Button variant="ghost" label={t('homes.wizard.exit')} onPress={onExit} />
    </View>
  );
}
