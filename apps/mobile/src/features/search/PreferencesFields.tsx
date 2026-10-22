import { HOME_TYPES } from '@changehouse/shared';
import { useTheme } from '@changehouse/ui';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Checkbox, Chip, ChoiceChips, type ChoiceOption, Text, TextField } from '../../ui';
import { AmountField } from './AmountField';
import {
  type FlagFilter,
  type Preferences,
  toggleFlag,
  toggleType,
  withFilters,
  withRadius,
} from './preferences';
import type { FormErrors, PreferencesForm } from './preferences-form';
import { ValueReferenceControl } from './ValueReferenceControl';
import { ZonePicker } from './ZonePicker';

const RADIUS_OPTIONS_KM = [2, 5, 10, 25, 50, 100] as const;
const ROOM_OPTIONS = ['1', '2', '3', '4', '5'] as const;
type MessageField = Exclude<keyof FormErrors, 'zone' | 'general'>;
const FLAGS: readonly FlagFilter[] = ['garage', 'lift', 'exterior'];

export interface PreferencesFieldsProps {
  form: PreferencesForm;
  onChange: (next: PreferencesForm) => void;
  errors: FormErrors;
  /** `true` en el primer uso y en las preferencias de una vivienda; en «Explorar» la zona va en la barra. */
  includeZone: boolean;
  /** `true` para mostrar también los filtros y el punto del rango (la hoja); el primer uso solo pide lo esencial. */
  full: boolean;
}

interface RoomsProps {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

/** Mínimo de dormitorios o baños: 1 a 5, y volver a pulsar la elegida la deja en «cualquiera». */
function RoomsChoice({ label, value, onChange }: Readonly<RoomsProps>) {
  const options: ChoiceOption<(typeof ROOM_OPTIONS)[number]>[] = ROOM_OPTIONS.map((room) => ({
    value: room,
    label: room,
  }));
  const current = ROOM_OPTIONS.find((room) => Number(room) === value) ?? '';
  return (
    <ChoiceChips
      label={label}
      options={options}
      value={current}
      onChange={(room) => {
        onChange(Number(room));
      }}
      onClear={() => {
        onChange(undefined);
      }}
    />
  );
}

/**
 * Los campos de las preferencias de búsqueda: zona, compensación en euros y, en la hoja completa,
 * radio, filtros y punto del rango. Los errores (del cliente o de la API) salen junto a su campo.
 */
export function PreferencesFields({
  form,
  onChange,
  errors,
  includeZone,
  full,
}: Readonly<PreferencesFieldsProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { draft } = form;
  const setDraft = (next: Preferences) => {
    onChange({ ...form, draft: next });
  };
  const message = (field: MessageField) =>
    errors[field] ? t(`search.errors.${field}`) : undefined;
  const radiusOptions = [
    ...new Set([...RADIUS_OPTIONS_KM, ...(draft.radiusKm ? [draft.radiusKm] : [])]),
  ]
    .sort((a, b) => a - b)
    .map((km) => ({ value: String(km), label: t('search.zone.radiusOption', { km }) }));

  return (
    <View style={{ gap: theme.space[4] }}>
      {includeZone ? (
        <ZonePicker
          preferences={draft}
          onChange={setDraft}
          error={errors.zone ? t('search.zone.required') : undefined}
        />
      ) : null}
      {full && draft.center ? (
        <ChoiceChips
          label={t('search.zone.radius')}
          options={radiusOptions}
          value={String(draft.radiusKm ?? '')}
          onChange={(km) => {
            setDraft(withRadius(draft, Number(km)));
          }}
          error={message('radius')}
        />
      ) : null}
      <View style={{ gap: theme.space[3] }}>
        {full ? <Text variant="heading">{t('search.sheet.compensation')}</Text> : null}
        <AmountField
          label={t('search.form.maxToPay')}
          hint={t('search.form.maxToPayHint')}
          value={form.maxToPay}
          onChange={(maxToPay) => {
            onChange({ ...form, maxToPay });
          }}
          error={message('maxToPay')}
        />
        <AmountField
          label={t('search.form.minToReceive')}
          hint={t('search.form.minToReceiveHint')}
          value={form.minToReceive}
          onChange={(minToReceive) => {
            onChange({ ...form, minToReceive });
          }}
          error={message('minToReceive')}
        />
        {full ? (
          <ValueReferenceControl
            value={draft.valueReferencePct}
            onChange={(valueReferencePct) => {
              setDraft({ ...draft, valueReferencePct });
            }}
            error={message('valueReferencePct')}
          />
        ) : null}
      </View>
      {full ? (
        <View style={{ gap: theme.space[3] }}>
          <Text variant="heading">{t('search.sheet.filters')}</Text>
          <View accessibilityLabel={t('search.form.types')} style={{ gap: theme.space[2] }}>
            <Text variant="label">{t('search.form.types')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
              {HOME_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={t(`homes.type.${type}`)}
                  selected={draft.filters?.types?.includes(type) ?? false}
                  onChange={() => {
                    setDraft(toggleType(draft, type));
                  }}
                />
              ))}
            </View>
          </View>
          <RoomsChoice
            label={t('search.form.minBedrooms')}
            value={draft.filters?.minBedrooms}
            onChange={(minBedrooms) => {
              setDraft(withFilters(draft, { minBedrooms }));
            }}
          />
          <RoomsChoice
            label={t('search.form.minBathrooms')}
            value={draft.filters?.minBathrooms}
            onChange={(minBathrooms) => {
              setDraft(withFilters(draft, { minBathrooms }));
            }}
          />
          <TextField
            label={t('search.form.minUsefulM2')}
            value={form.minUsefulM2}
            onChangeText={(minUsefulM2) => {
              onChange({ ...form, minUsefulM2 });
            }}
            keyboardType="decimal-pad"
            autoComplete="off"
            error={message('minUsefulM2')}
          />
          {FLAGS.map((flag) => (
            <Checkbox
              key={flag}
              label={t(`search.form.${flag}`)}
              checked={draft.filters?.[flag] === true}
              onChange={() => {
                setDraft(toggleFlag(draft, flag));
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
