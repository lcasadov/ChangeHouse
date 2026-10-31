import { type HomePatch, isProtectedRegime } from '@changehouse/shared';
import { useTheme } from '@changehouse/ui';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '../../ui';
import { CheckControl, MoneyControl } from './form-fields';
import {
  formatEuros,
  type ValueContext,
  valueDefaults,
  valueResolver,
  type ValueValues,
} from './home-form';
import { StepActions } from './StepActions';
import type { StepProps } from './steps';
import { useUpdateHome } from './use-homes';
import { useStepSubmit } from './use-step-submit';

/** El tope del valor máximo: el precio máximo legal de una vivienda protegida, si se conoce (RN-06). */
function legalCapOf(home: StepProps['home']): number | null {
  if (!home || !isProtectedRegime(home.regime)) return null;
  return home.vppMaxLegalPriceCents ?? null;
}

/**
 * Paso 5, valor y cargas: el rango en euros (se guarda en céntimos), la hipoteca y si es la
 * vivienda habitual. En una vivienda protegida, el máximo muestra el tope legal y no lo supera.
 */
export function ValueStep({ home, onSaved, onBack, onExit, confirmSave }: Readonly<StepProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const update = useUpdateHome(home?.id ?? '');
  const legalCap = legalCapOf(home);
  const form = useForm<ValueValues, ValueContext, HomePatch>({
    resolver: valueResolver,
    context: { maxLegalPriceCents: legalCap },
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
      // El servidor tiene la última palabra sobre el rango y el tope legal, aunque el formulario
      // los diera por buenos
      if (error.kind === 'invalid-value-range') {
        form.setError('valueMax', { type: 'range' });
        return true;
      }
      if (error.kind === 'above-legal-price') {
        form.setError('valueMax', { type: 'aboveLegalPrice' });
        return true;
      }
      return false;
    },
  );
  const control = form.control;

  return (
    <View style={{ gap: theme.space[4] }}>
      <Text tone="textMuted">{t('homes.form.valueHint')}</Text>
      <MoneyControl control={control} name="valueMin" label={t('homes.form.valueMin')} />
      <MoneyControl
        control={control}
        name="valueMax"
        label={t('homes.form.valueMax')}
        {...(legalCap === null
          ? {}
          : { hint: t('homes.form.valueMaxLegalHint', { amount: formatEuros(legalCap) }) })}
      />
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
