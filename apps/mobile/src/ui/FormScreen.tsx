import { useTheme } from '@changehouse/ui';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { Screen } from './Screen';

/**
 * Pantalla de formulario: respeta las zonas seguras, sube con el teclado y se desplaza si el
 * contenido no cabe (texto grande, pantallas pequeñas). El toque fuera de un campo no pierde el foco
 * de los botones (`keyboardShouldPersistTaps`).
 */
export function FormScreen({
  children,
  header,
}: Readonly<{
  children: ReactNode;
  /** Contenido decorativo antes del formulario (la foto del acceso), dentro del desplazamiento. */
  header?: ReactNode;
}>) {
  const theme = useTheme();
  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: theme.space[4], paddingVertical: theme.space[5] }}
        >
          {header}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
