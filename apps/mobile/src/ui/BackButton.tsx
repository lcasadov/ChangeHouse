import { touchTarget, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { useFocusRing } from './useFocusRing';

export interface BackButtonProps {
  /** Nombre accesible: a dónde se vuelve. */
  label: string;
  onPress: () => void;
}

/** Flecha de volver de las pantallas a pantalla completa, con foco visible y objetivo táctil mínimo. */
export function BackButton({ label, onPress }: Readonly<BackButtonProps>) {
  const theme = useTheme();
  const focusRing = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onFocus={focusRing.onFocus}
      onBlur={focusRing.onBlur}
      style={[
        styles.base,
        { borderRadius: theme.radius.full, minHeight: touchTarget, minWidth: touchTarget },
        focusRing.style,
      ]}
    >
      <Ionicons
        accessible={false}
        name="arrow-back"
        size={theme.space[5]}
        color={theme.color.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', alignSelf: 'flex-start', justifyContent: 'center' },
});
