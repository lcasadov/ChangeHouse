import { borderWidth, touchTarget, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { FieldError } from './FieldError';
import { Text } from './Text';
import { useFocusRing } from './useFocusRing';

export interface CheckboxProps {
  /** Texto visible; también es el nombre accesible. */
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Mensaje de error ya traducido, junto a la casilla. */
  error?: string | undefined;
}

export function Checkbox({ label, checked, onChange, error }: Readonly<CheckboxProps>) {
  const theme = useTheme();
  const focusRing = useFocusRing();
  const boxSize = theme.space[5];

  return (
    <View style={{ gap: theme.space[1] }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked }}
        onPress={() => {
          onChange(!checked);
        }}
        onFocus={focusRing.onFocus}
        onBlur={focusRing.onBlur}
        style={[
          styles.row,
          { gap: theme.space[3], minHeight: touchTarget, minWidth: touchTarget },
          focusRing.style,
        ]}
      >
        <View
          accessible={false}
          style={[
            styles.box,
            {
              backgroundColor: checked ? theme.color.primary : theme.color.surface,
              borderColor: error ? theme.color.danger : theme.color.primary,
              borderRadius: theme.radius.sm,
              borderWidth: borderWidth.thick,
              height: boxSize,
              width: boxSize,
            },
          ]}
        >
          {checked ? (
            <Ionicons name="checkmark" size={theme.space[4]} color={theme.color.textOnPrimary} />
          ) : null}
        </View>
        <Text style={styles.label} accessible={false}>
          {label}
        </Text>
      </Pressable>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  label: { flexShrink: 1 },
  row: { alignItems: 'center', flexDirection: 'row' },
});
