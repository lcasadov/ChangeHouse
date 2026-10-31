import { contentMaxWidth, useTheme } from '@changehouse/ui';
import type { ReactNode } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { Button, type ButtonVariant } from './Button';
import { Text } from './Text';

export interface DialogProps {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** También se llama con Escape (web) y con el gesto o botón de volver (Android). */
  onCancel: () => void;
  /** Contenido propio bajo la descripción (p. ej. un campo de confirmación). */
  children?: ReactNode;
  /** La confirmación no se puede pulsar todavía. */
  confirmDisabled?: boolean;
  /** Variante del botón de confirmar; `danger` para acciones destructivas. */
  confirmVariant?: ButtonVariant;
}

/**
 * Diálogo de confirmación (`docs/style-guide.md` §3 y §5). Modal: el resto de la pantalla queda
 * fuera del alcance de los lectores de pantalla y del teclado, y el foco vuelve al control que lo abrió
 * al cerrarse. Nombra lo que ocurre; la persona confirma o cancela, nunca queda sin salida.
 */
export function Dialog({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  children,
  confirmDisabled = false,
  confirmVariant = 'primary',
}: Readonly<DialogProps>) {
  const theme = useTheme();
  const elevation = theme.elevation[3];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View
        style={[styles.overlay, { backgroundColor: theme.color.overlay, padding: theme.space[4] }]}
      >
        <View
          role="alertdialog"
          aria-modal
          aria-label={title}
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
              borderRadius: theme.radius.lg,
              gap: theme.space[3],
              maxWidth: contentMaxWidth.card,
              padding: theme.space[5],
            },
          ]}
        >
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          <Text tone="textMuted">{description}</Text>
          {children}
          <View style={{ gap: theme.space[2], paddingTop: theme.space[2] }}>
            <Button
              label={confirmLabel}
              variant={confirmVariant}
              disabled={confirmDisabled}
              onPress={onConfirm}
            />
            <Button variant="ghost" label={cancelLabel} onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  panel: { width: '100%' },
});
