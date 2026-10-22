import { useTheme } from '@changehouse/ui';
import { StyleSheet, View } from 'react-native';

import { Chip } from './Chip';
import { FieldError } from './FieldError';
import { Text } from './Text';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

export interface ChoiceChipsProps<T extends string> {
  /** Etiqueta visible del grupo; también es su nombre accesible. */
  label: string;
  options: readonly ChoiceOption<T>[];
  /** La opción elegida, o cadena vacía si aún no se ha elegido ninguna. */
  value: T | '';
  onChange: (value: T) => void;
  /** Si se indica, pulsar la opción ya elegida la deselecciona (elección opcional). */
  onClear?: () => void;
  /** Mensaje de error ya traducido, junto al grupo. */
  error?: string | undefined;
}

/** Elección de una opción entre pocas (`docs/style-guide.md` §3 «Select / SegmentedControl»). */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  onClear,
  error,
}: Readonly<ChoiceChipsProps<T>>) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space[2] }}>
      <Text variant="label">{label}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={[styles.group, { gap: theme.space[2] }]}
      >
        {options.map((option) => (
          <Chip
            key={option.value}
            kind="radio"
            label={option.label}
            selected={option.value === value}
            onChange={() => {
              if (onClear && option.value === value) onClear();
              else onChange(option.value);
            }}
          />
        ))}
      </View>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ group: { flexDirection: 'row', flexWrap: 'wrap' } });
