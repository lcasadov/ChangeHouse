import { type Control, Controller, type FieldValues, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { KeyboardTypeOptions } from 'react-native';

import { Checkbox, Chip, ChoiceChips, type ChoiceOption, TextField } from '../../ui';
import { errorKeyOf, euroFieldText, formatEuros, type FormField, parseEuros } from './home-form';

/** Un campo de un formulario de paso: su control de React Hook Form y su nombre. */
interface FieldProps<V extends FieldValues, C, O extends FieldValues> {
  control: Control<V, C, O>;
  name: Path<V>;
  label: string;
}

/** El texto del error de un campo según el tipo de fallo, o `undefined` si no hay. */
export function useErrorText() {
  const { t } = useTranslation();
  return (field: string, type: string | undefined): string | undefined =>
    type ? t(`homes.errors.${errorKeyOf(field as FormField, type)}`) : undefined;
}

const asText = (value: unknown) => (typeof value === 'string' ? value : '');

interface TextControlProps<V extends FieldValues, C, O extends FieldValues> extends FieldProps<
  V,
  C,
  O
> {
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
}

export function TextControl<V extends FieldValues, C, O extends FieldValues>({
  control,
  name,
  label,
  hint,
  keyboardType,
  maxLength,
}: Readonly<TextControlProps<V, C, O>>) {
  const errorText = useErrorText();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          label={label}
          value={asText(field.value)}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={errorText(name, fieldState.error?.type)}
          autoComplete="off"
          {...(hint ? { hint } : {})}
          {...(keyboardType ? { keyboardType } : {})}
          {...(maxLength ? { maxLength } : {})}
        />
      )}
    />
  );
}

/**
 * Un importe en euros: al escribir muestra cómo se lee («Son 250.000 €») y al salir del campo lo
 * deja con separadores de miles es-ES. Lo escrito se interpreta igual que al guardar (`parseEuros`).
 */
export function MoneyControl<V extends FieldValues, C, O extends FieldValues>({
  control,
  name,
  label,
  hint,
}: Readonly<Omit<TextControlProps<V, C, O>, 'keyboardType' | 'maxLength'>>) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const text = asText(field.value);
        const cents = parseEuros(text);
        const preview =
          cents !== undefined && !Number.isNaN(cents) && cents > 0
            ? t('homes.form.valuePreview', { amount: formatEuros(cents) })
            : hint;
        return (
          <TextField
            label={label}
            value={text}
            onChangeText={field.onChange}
            onBlur={() => {
              if (cents !== undefined && !Number.isNaN(cents)) field.onChange(euroFieldText(cents));
              field.onBlur();
            }}
            error={errorText(name, fieldState.error?.type)}
            keyboardType="decimal-pad"
            autoComplete="off"
            {...(preview ? { hint: preview } : {})}
          />
        );
      }}
    />
  );
}

export function CheckControl<V extends FieldValues, C, O extends FieldValues>({
  control,
  name,
  label,
}: Readonly<FieldProps<V, C, O>>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Checkbox label={label} checked={field.value === true} onChange={field.onChange} />
      )}
    />
  );
}

export function ChipControl<V extends FieldValues, C, O extends FieldValues>({
  control,
  name,
  label,
}: Readonly<FieldProps<V, C, O>>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Chip label={label} selected={field.value === true} onChange={field.onChange} />
      )}
    />
  );
}

interface ChoiceControlProps<
  V extends FieldValues,
  C,
  O extends FieldValues,
  T extends string,
> extends FieldProps<V, C, O> {
  options: readonly ChoiceOption<T>[];
  /** Elección opcional: se puede volver a dejar sin elegir. */
  optional?: boolean;
}

export function ChoiceControl<V extends FieldValues, C, O extends FieldValues, T extends string>({
  control,
  name,
  label,
  options,
  optional = false,
}: Readonly<ChoiceControlProps<V, C, O, T>>) {
  const errorText = useErrorText();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <ChoiceChips
          label={label}
          options={options}
          value={asText(field.value) as T | ''}
          onChange={field.onChange}
          {...(optional ? { onClear: () => field.onChange('') } : {})}
          error={errorText(name, fieldState.error?.type)}
        />
      )}
    />
  );
}
