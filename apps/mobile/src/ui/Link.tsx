import { touchTarget } from '@changehouse/ui';
import { Linking, Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { useFocusRing } from './useFocusRing';

export type LinkProps = { label: string } & (
  { href: string; onPress?: undefined } | { onPress: () => void; href?: undefined }
);

/** Enlace: abre una dirección externa (`href`) o navega dentro de la app (`onPress`). Va subrayado. */
export function Link({ label, href, onPress }: Readonly<LinkProps>) {
  const focusRing = useFocusRing();

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    // Sin navegador o sin permiso no hay nada útil que mostrar: la persona sigue donde estaba
    Linking.openURL(href).catch(() => undefined);
  };

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={handlePress}
      onFocus={focusRing.onFocus}
      onBlur={focusRing.onBlur}
      style={[styles.base, { minHeight: touchTarget, minWidth: touchTarget }, focusRing.style]}
    >
      <Text variant="bodyStrong" tone="primary" style={styles.label} accessible={false}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { justifyContent: 'center' },
  label: { textDecorationLine: 'underline' },
});
