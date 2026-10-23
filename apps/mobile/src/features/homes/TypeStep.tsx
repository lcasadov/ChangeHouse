import { HOME_TYPES } from '@changehouse/shared';
import { useTheme } from '@changehouse/ui';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AddressField } from './AddressField';
import { ChoiceControl, useErrorText } from './form-fields';
import {
  type TypeStepContext,
  typeStepDefaults,
  type TypeStepOutput,
  typeStepResolver,
  type TypeStepValues,
} from './home-form';
import { StepActions } from './StepActions';
import type { StepProps } from './steps';
import { useCreateHome, useUpdateHome } from './use-homes';
import { useStepSubmit } from './use-step-submit';

/**
 * Paso 1, tipo y dirección. En el alta crea el borrador (`createHome`); en uno existente actualiza
 * el tipo y, solo si se ha elegido otra, la dirección.
 */
export function TypeStep({ home, onSaved, onExit, onBack, confirmSave }: Readonly<StepProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const create = useCreateHome();
  const update = useUpdateHome(home?.id ?? '');
  const form = useForm<TypeStepValues, TypeStepContext | undefined, TypeStepOutput>({
    resolver: typeStepResolver,
    context: { hasSavedAddress: home !== undefined },
    defaultValues: typeStepDefaults(home),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const { submit, saving, failure } = useStepSubmit(
    form,
    async ({ type, address }) => {
      if (home) {
        const patch = { type, ...(address ? { address } : {}) };
        if (confirmSave && !(await confirmSave(patch))) return;
        onSaved(await update.mutateAsync(patch));
      } else if (address) {
        onSaved(await create.mutateAsync({ type, address }));
      }
    },
    (error) => {
      if (error.kind !== 'address-not-resolved') return false;
      // Hay que elegir otra sugerencia: la elegida deja de valer
      form.setValue('address', null);
      form.setError('address', { type: 'unresolved' });
      return true;
    },
  );

  return (
    <View style={{ gap: theme.space[4] }}>
      <ChoiceControl
        control={form.control}
        name="type"
        label={t('homes.form.type')}
        options={HOME_TYPES.map((value) => ({ value, label: t(`homes.type.${value}`) }))}
      />
      <Controller
        control={form.control}
        name="address"
        render={({ field, fieldState }) => (
          <AddressField
            value={field.value}
            savedAddress={home?.address}
            onChange={field.onChange}
            error={errorText('address', fieldState.error?.type)}
          />
        )}
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
