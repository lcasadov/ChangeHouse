import { borderWidth, disabledOpacity, touchTarget, useTheme } from '@changehouse/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useFocusRing } from './useFocusRing';

export interface SwitchProps {
  /** Texto visible; también es el nombre accesible. */
  label: string;
  /** Qué ocurre al activarlo; es la ayuda del control para los lectores de pantalla. */
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * Interruptor (`docs/style-guide.md` §3): un booleano que se aplica al instante. El estado lo dice la
 * posición del pulgar además del color de la pista, y el lector de pantalla lo anuncia como activado.
 */
export function Switch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: Readonly<SwitchProps>) {
  const theme = useTheme();
  const focusRing = useFocusRing();
  const thumbSize = theme.space[4];

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      {...(description ? { accessibilityHint: description } : {})}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => {
        onChange(!checked);
      }}
      onFocus={focusRing.onFocus}
      onBlur={focusRing.onBlur}
      style={[
        styles.row,
        {
          gap: theme.space[3],
          minHeight: touchTarget,
          minWidth: touchTarget,
          opacity: disabled ? disabledOpacity : 1,
        },
        focusRing.style,
      ]}
    >
      <View style={[styles.text, { gap: theme.space[1] }]}>
        <Text variant="bodyStrong" accessible={false}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" tone="textMuted" accessible={false}>
            {description}
          </Text>
        ) : null}
      </View>
      <View
        testID="switch-track"
        accessible={false}
        style={{
          backgroundColor: checked ? theme.color.primary : theme.color.surfaceMuted,
          borderColor: checked ? theme.color.primary : theme.color.borderStrong,
          borderRadius: theme.radius.full,
          borderWidth: borderWidth.thick,
          justifyContent: 'center',
          paddingHorizontal: theme.space[1],
          width: theme.space[7],
          height: thumbSize + theme.space[2],
        }}
      >
        <View
          testID="switch-thumb"
          style={{
            alignSelf: checked ? 'flex-end' : 'flex-start',
            backgroundColor: checked ? theme.color.surface : theme.color.textMuted,
            borderRadius: theme.radius.full,
            height: thumbSize - theme.space[1],
            width: thumbSize - theme.space[1],
          }}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row' },
  text: { flex: 1 },
});
