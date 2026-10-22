import { HOME_REGIMES, type HomePatch, isProtectedRegime } from '@changehouse/shared';
import { useTheme } from '@changehouse/ui';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '../../ui';
import { ChoiceControl, MoneyControl, TextControl } from './form-fields';
import {
  type RegimeContext,
  regimeDefaults,
  regimeResolver,
  type RegimeValues,
  sameAsSaved,
} from './home-form';
import { StepActions } from './StepActions';
import type { StepProps } from './steps';
import { useUpdateHome } from './use-homes';
import { useStepSubmit } from './use-step-submit';

const DATE_LENGTH = 10;

/**
 * Paso 3, régimen de protección (RF-14): libre, VPPB, VPPL o VPO. Una vivienda protegida pide la
 * fecha de calificación definitiva y, si se conocen, el fin de la protección y el precio máximo
 * legal; una libre no pide nada más. Si nada cambia respecto a lo guardado, solo avanza.
 */
export function RegimeStep({ home, onSaved, onBack, onExit }: Readonly<StepProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const update = useUpdateHome(home?.id ?? '');
  const form = useForm<RegimeValues, RegimeContext, HomePatch>({
    resolver: regimeResolver,
    context: { valueMaxCents: home?.valueMaxCents ?? null },
    defaultValues: regimeDefaults(home),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const regime = useWatch({ control: form.control, name: 'regime' });
  const { submit, saving, failure } = useStepSubmit(
    form,
    async (patch) => {
      if (!home) return;
      onSaved(sameAsSaved(home, patch) ? home : await update.mutateAsync(patch));
    },
    (error) => {
      // El servidor tiene la última palabra sobre el tope legal, aunque el valor guardado que
      // conoce el formulario estuviera desfasado
      if (error.kind !== 'above-legal-price') return false;
      form.setError('maxLegalPrice', { type: 'belowValue' });
      return true;
    },
  );
  const control = form.control;

  return (
    <View style={{ gap: theme.space[4] }}>
      <Text tone="textMuted">{t('homes.form.regimeHint')}</Text>
      <ChoiceControl
        control={control}
        name="regime"
        label={t('homes.form.regime')}
        options={HOME_REGIMES.map((value) => ({ value, label: t(`homes.regime.${value}`) }))}
      />
      {isProtectedRegime(regime) ? (
        <>
          <TextControl
            control={control}
            name="qualificationDate"
            label={t('homes.form.vppQualificationDate')}
            hint={t('homes.form.vppQualificationDateHint')}
            keyboardType="numbers-and-punctuation"
            maxLength={DATE_LENGTH}
          />
          <TextControl
            control={control}
            name="protectionEnd"
            label={t('homes.form.vppProtectionEnd')}
            hint={t('homes.form.vppProtectionEndHint')}
            keyboardType="numbers-and-punctuation"
            maxLength={DATE_LENGTH}
          />
          <MoneyControl
            control={control}
            name="maxLegalPrice"
            label={t('homes.form.vppMaxLegalPrice')}
            hint={t('homes.form.vppMaxLegalPriceHint')}
          />
        </>
      ) : null}
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
