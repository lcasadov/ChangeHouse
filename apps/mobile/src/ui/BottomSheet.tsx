import { contentMaxWidth, useTheme } from '@changehouse/ui';
import type { ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';

export interface BottomSheetProps {
  visible: boolean;
  title: string;
  /** Nombre del botón que la cierra (siempre hay uno alcanzable, además del gesto de volver). */
  closeLabel: string;
  /** También se llama con Escape (web) y con el gesto o botón de volver (Android). */
  onClose: () => void;
  children: ReactNode;
}

/**
 * Hoja inferior (`docs/style-guide.md` §3): tarea breve sobre la pantalla, con el contenido
 * desplazable. Modal: el resto queda fuera del alcance de los lectores de pantalla y del teclado.
 */
export function BottomSheet({
  visible,
  title,
  closeLabel,
  onClose,
  children,
}: Readonly<BottomSheetProps>) {
  const theme = useTheme();
  const elevation = theme.elevation[3];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={[styles.overlay, { backgroundColor: theme.color.overlay }]}>
        <View
          role="dialog"
          aria-modal
          aria-label={title}
          accessibilityLabel={title}
          accessibilityViewIsModal
          style={[
            styles.panel,
            {
              backgroundColor: elevation.surface,
              borderColor: elevation.borderColor,
              borderWidth: elevation.borderWidth,
              elevation: elevation.androidElevation,
              shadowColor: elevation.shadowColor,
              shadowOffset: elevation.shadowOffset,
              shadowOpacity: elevation.shadowOpacity,
              shadowRadius: elevation.shadowRadius,
              borderTopLeftRadius: theme.radius.lg,
              borderTopRightRadius: theme.radius.lg,
              maxWidth: contentMaxWidth.reading,
              padding: theme.space[4],
              gap: theme.space[3],
            },
          ]}
        >
          <View style={[styles.header, { gap: theme.space[2] }]}>
            <Text variant="heading" accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Button variant="ghost" label={closeLabel} onPress={onClose} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: theme.space[4], paddingBottom: theme.space[5] }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row' },
  overlay: { alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  panel: { maxHeight: '90%', width: '100%' },
  title: { flex: 1 },
});
