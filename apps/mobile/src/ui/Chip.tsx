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
  /**
   * `checkbox`: varias a la vez; `radio`: una opción de un grupo (`ChoiceChips`); `toggle`: filtro
   * de un toque que se anuncia como botón «seleccionado» (barra de filtros de la búsqueda).
   */
  kind?: 'checkbox' | 'radio' | 'toggle';
  /** Solo con `toggle`: el filtro despliega opciones; se anuncia si están a la vista. */
  expanded?: boolean;
}

/** Rol y estado accesibles de cada tipo de chip. */
function semanticsOf(kind: NonNullable<ChipProps['kind']>, selected: boolean, expanded?: boolean) {
  if (kind === 'toggle') {
    return {
      role: 'button',
      state: { selected, ...(expanded === undefined ? {} : { expanded }) },
    } as const;
  }
  return { role: kind, state: { checked: selected } } as const;
}

/** Chip seleccionable (`docs/style-guide.md` §3): el elegido lleva marca además del color. */
export function Chip({
  label,
  selected,
  onChange,
  kind = 'checkbox',
  expanded,
}: Readonly<ChipProps>) {
  const theme = useTheme();
  const focusRing = useFocusRing();
  const foreground = selected ? theme.color.textOnPrimary : theme.color.text;
  const { role, state } = semanticsOf(kind, selected, expanded);

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={state}
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
