import { useTheme } from '@changehouse/ui';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AMBIENT, FormScreen, useBreakpoint } from '../../ui';

/** La fotografía de ambiente del acceso: decorativa, nunca la leen los lectores de pantalla. */
function AuthPhoto({ height, rounded }: Readonly<{ height?: number; rounded: boolean }>) {
  const theme = useTheme();
  return (
    <View
      testID="auth-photo"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.photo,
        height === undefined ? styles.fill : { height },
        rounded ? { borderRadius: theme.radius.lg } : null,
      ]}
    >
      <Image source={AMBIENT.access} contentFit="cover" style={StyleSheet.absoluteFill} />
    </View>
  );
}

/**
 * Pantallas de acceso y de recuperación de la contraseña: en web ancha, dos columnas con la
 * fotografía a la izquierda y el formulario a la derecha; en el resto, una franja de foto encima.
 */
export function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  const theme = useTheme();
  const breakpoint = useBreakpoint();

  if (breakpoint === 'expanded') {
    return (
      <View testID="auth-split" style={[styles.split, { backgroundColor: theme.color.bg }]}>
        <AuthPhoto rounded={false} />
        <View style={styles.fill}>
          <FormScreen>{children}</FormScreen>
        </View>
      </View>
    );
  }

  return (
    <FormScreen header={<AuthPhoto rounded height={theme.space[8] * 3} />}>{children}</FormScreen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  photo: { overflow: 'hidden', width: '100%' },
  split: { flex: 1, flexDirection: 'row' },
});
