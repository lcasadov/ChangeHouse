import type { HomePatch } from '@changehouse/shared';
import { useTheme } from '@changehouse/ui';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '../../ui';
import { CheckControl, MoneyControl } from './form-fields';
import { valueDefaults, valueResolver, type ValueValues } from './home-form';
import { StepActions } from './StepActions';
import type { StepProps } from './steps';
import { useUpdateHome } from './use-homes';
import { useStepSubmit } from './use-step-submit';

/** Paso 3, valor y cargas: el rango en euros (se guarda en céntimos), la hipoteca y si es la vivienda habitual. */
export function ValueStep({ home, onSaved, onBack, onExit, confirmSave }: Readonly<StepProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const update = useUpdateHome(home?.id ?? '');
  const form = useForm<ValueValues, unknown, HomePatch>({
    resolver: valueResolver,
    defaultValues: valueDefaults(home),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const { submit, saving, failure } = useStepSubmit(
    form,
    async (patch) => {
      if (confirmSave && !(await confirmSave(patch))) return;
      onSaved(await update.mutateAsync(patch));
    },
    (error) => {
      if (error.kind !== 'invalid-value-range') return false;
      // El servidor tiene la última palabra sobre el rango, aunque el formulario lo diera por bueno
      form.setError('valueMax', { type: 'range' });
      return true;
    },
  );
  const control = form.control;

  return (
    <View style={{ gap: theme.space[4] }}>
      <Text tone="textMuted">{t('homes.form.valueHint')}</Text>
      <MoneyControl control={control} name="valueMin" label={t('homes.form.valueMin')} />
      <MoneyControl control={control} name="valueMax" label={t('homes.form.valueMax')} />
      <MoneyControl
        control={control}
        name="mortgage"
        label={t('homes.form.mortgage')}
        hint={t('homes.form.mortgageHint')}
      />
      <CheckControl
        control={control}
        name="isPrimaryResidence"
        label={t('homes.form.isPrimaryResidence')}
      />
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
