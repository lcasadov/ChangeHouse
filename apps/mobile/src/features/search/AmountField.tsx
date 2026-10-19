import { useTranslation } from 'react-i18next';

import { TextField } from '../../ui';
import { euroFieldText, formatEuros, parseEuros } from '../homes/home-form';

export interface AmountFieldProps {
  label: string;
  hint: string;
  /** Lo escrito, tal cual: se interpreta al guardar. */
  value: string;
  onChange: (text: string) => void;
  error?: string | undefined;
}

/**
 * Un importe en euros: al escribir muestra cómo se lee («Son 25.000 €») y al salir del campo lo deja
 * con separadores de miles es-ES. Se guarda en céntimos.
 */
export function AmountField({ label, hint, value, onChange, error }: Readonly<AmountFieldProps>) {
  const { t } = useTranslation();
  const cents = parseEuros(value);
  const valid = cents !== undefined && !Number.isNaN(cents);
  const preview =
    valid && cents > 0 ? t('search.form.amountPreview', { amount: formatEuros(cents) }) : hint;

  return (
    <TextField
      label={label}
      hint={preview}
      value={value}
      onChangeText={onChange}
      onBlur={() => {
        if (valid) onChange(euroFieldText(cents));
      }}
      keyboardType="decimal-pad"
      autoComplete="off"
      error={error}
    />
  );
}
