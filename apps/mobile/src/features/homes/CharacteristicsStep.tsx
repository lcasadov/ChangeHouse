import {
  ENERGY_RATINGS,
  HEATING_TYPES,
  HOME_CONDITIONS,
  type HomePatch,
} from '@changehouse/shared';
import { useTheme } from '@changehouse/ui';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '../../ui';
import { CheckControl, ChipControl, ChoiceControl, TextControl } from './form-fields';
import {
  characteristicsDefaults,
  characteristicsResolver,
  type CharacteristicsValues,
  FEATURE_FLAGS,
} from './home-form';
import { StepActions } from './StepActions';
import type { StepProps } from './steps';
import { useUpdateHome } from './use-homes';
import { useStepSubmit } from './use-step-submit';

/** Paso 2, características: superficies, estancias, planta, extras, certificado y año. Todo se puede dejar para después. */
export function CharacteristicsStep({ home, onSaved, onBack, onExit }: Readonly<StepProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const update = useUpdateHome(home?.id ?? '');
  const form = useForm<CharacteristicsValues, unknown, HomePatch>({
    resolver: characteristicsResolver,
    defaultValues: characteristicsDefaults(home),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const { submit, saving, failure } = useStepSubmit(form, async (patch) => {
    onSaved(await update.mutateAsync(patch));
  });
  const control = form.control;

  return (
    <View style={{ gap: theme.space[4] }}>
      <TextControl
        control={control}
        name="usefulM2"
        label={t('homes.form.usefulM2')}
        keyboardType="decimal-pad"
      />
      <TextControl
        control={control}
        name="builtM2"
        label={t('homes.form.builtM2')}
        keyboardType="decimal-pad"
      />
      <TextControl
        control={control}
        name="bedrooms"
        label={t('homes.form.bedrooms')}
        keyboardType="number-pad"
      />
      <TextControl
        control={control}
        name="bathrooms"
        label={t('homes.form.bathrooms')}
        keyboardType="number-pad"
      />
      <TextControl
        control={control}
        name="floor"
        label={t('homes.form.floor')}
        hint={t('homes.form.floorHint')}
        maxLength={20}
      />
      <CheckControl control={control} name="hasLift" label={t('homes.form.hasLift')} />
      <CheckControl control={control} name="garage" label={t('homes.form.garage')} />
      <CheckControl control={control} name="storageRoom" label={t('homes.form.storageRoom')} />

      <View style={{ gap: theme.space[2] }}>
        <Text variant="label">{t('homes.form.features')}</Text>
        <View style={[styles.chips, { gap: theme.space[2] }]}>
          {FEATURE_FLAGS.map((flag) => (
            <ChipControl
              key={flag}
              control={control}
              name={`features.${flag}`}
              label={t(`homes.features.${flag}`)}
            />
          ))}
        </View>
      </View>
      <ChoiceControl
        control={control}
        name="heating"
        label={t('homes.form.heating')}
        options={HEATING_TYPES.map((value) => ({ value, label: t(`homes.heating.${value}`) }))}
        optional
      />
      <ChoiceControl
        control={control}
        name="condition"
        label={t('homes.form.condition')}
        options={HOME_CONDITIONS.map((value) => ({ value, label: t(`homes.condition.${value}`) }))}
        optional
      />
      <ChoiceControl
        control={control}
        name="energyRating"
        label={t('homes.form.energyRating')}
        options={ENERGY_RATINGS.map((value) => ({ value, label: value }))}
        optional
      />
      <TextControl
        control={control}
        name="yearBuilt"
        label={t('homes.form.yearBuilt')}
        keyboardType="number-pad"
        maxLength={4}
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

const styles = StyleSheet.create({ chips: { flexDirection: 'row', flexWrap: 'wrap' } });
