import { contentMaxWidth, useTheme } from '@changehouse/ui';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBreakpoint } from './useBreakpoint';

/** Contenedor de pantalla: fondo del tema, zona segura, márgenes por punto de corte y ancho de lectura. */
export function Screen({ children }: Readonly<{ children: ReactNode }>) {
  const theme = useTheme();
  const breakpoint = useBreakpoint();
  const margin = breakpoint === 'compact' ? theme.space[4] : theme.space[6];

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.root, { backgroundColor: theme.color.bg, paddingHorizontal: margin }]}
    >
      <View style={[styles.content, { maxWidth: contentMaxWidth.reading }]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', flex: 1 },
  content: { flex: 1, width: '100%' },
});
