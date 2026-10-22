import { borderWidth, touchTarget, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { useFocusRing } from './useFocusRing';

export interface ChipProps {
  /** Texto visible; también es el nombre accesible. */
  label: string;
  selected: boolean;
  /** Pide el nuevo valor: el contrario si es una casilla; siempre `true` si es una opción. */
  onChange: (selected: boolean) => void;
  /** `checkbox`: varias a la vez; `radio`: una opción de un grupo (`ChoiceChips`). */
  kind?: 'checkbox' | 'radio';
}

/** Chip seleccionable (`docs/style-guide.md` §3): el elegido lleva marca además del color. */
export function Chip({ label, selected, onChange, kind = 'checkbox' }: Readonly<ChipProps>) {
  const theme = useTheme();
  const focusRing = useFocusRing();
  const foreground = selected ? theme.color.textOnPrimary : theme.color.text;

  return (
    <Pressable
      accessibilityRole={kind}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={() => {
        onChange(kind === 'radio' ? true : !selected);
      }}
      onFocus={focusRing.onFocus}
      onBlur={focusRing.onBlur}
      style={[
        styles.root,
        {
          backgroundColor: selected ? theme.color.primary : theme.color.surface,
          borderColor: selected ? theme.color.primary : theme.color.borderStrong,
          borderRadius: theme.radius.full,
          borderWidth: borderWidth.thin,
          gap: theme.space[1],
          minHeight: touchTarget,
          minWidth: touchTarget,
          paddingHorizontal: theme.space[3],
        },
        focusRing.style,
      ]}
    >
      {selected ? (
        <Ionicons
          accessible={false}
          name="checkmark"
          size={theme.font.label.lineHeight}
          color={foreground}
        />
      ) : null}
      <Text variant="label" accessible={false} style={{ color: foreground }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
});
