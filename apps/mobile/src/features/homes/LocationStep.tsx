import { type HomePatch, LOCATION_VISIBILITIES } from '@changehouse/shared';
import { useTheme } from '@changehouse/ui';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Notice, Text } from '../../ui';
import { ChoiceControl } from './form-fields';
import { locationDefaults, locationResolver, type LocationValues } from './home-form';
import { StepActions } from './StepActions';
import type { StepProps } from './steps';
import { useUpdateHome } from './use-homes';
import { useStepSubmit } from './use-step-submit';

/**
 * Paso 4, ubicación visible: el propietario decide si las demás personas ven el barrio o zona
 * (por defecto) o el punto exacto. La dirección postal es privada en ambos casos.
 */
export function LocationStep({ home, onSaved, onBack, onExit }: Readonly<StepProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const update = useUpdateHome(home?.id ?? '');
  const form = useForm<LocationValues, unknown, HomePatch>({
    resolver: locationResolver,
    defaultValues: locationDefaults(home),
  });
  const visibility = useWatch({ control: form.control, name: 'locationVisibility' });
  const { submit, saving, failure } = useStepSubmit(form, async (patch) => {
    onSaved(await update.mutateAsync(patch));
  });
  const area = home?.location.areaName ?? '';

  return (
    <View style={{ gap: theme.space[4] }}>
      <Text variant="bodyStrong">{t('homes.location.title')}</Text>
      <ChoiceControl
        control={form.control}
        name="locationVisibility"
        label={t('homes.location.visibility')}
        options={LOCATION_VISIBILITIES.map((value) => ({
          value,
          label: t(`homes.location.${value}`),
        }))}
      />
      <Notice tone="info">
        {visibility === 'exact'
          ? t('homes.location.exactExplanation', { area })
          : t('homes.location.areaExplanation', { area })}
      </Notice>
      <Text tone="textMuted">{t('homes.location.privacy')}</Text>
      <StepActions
        saving={saving}
        failure={failure}
        onNext={submit}
        onBack={onBack}
        onExit={onExit}
      />
    </View>
  );
}
