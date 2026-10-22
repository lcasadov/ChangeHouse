import { contentMaxWidth, useTheme } from '@changehouse/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Chip, Notice, Text, TextField } from '../../ui';
import { REASON_MAX_LENGTH, validateReason } from './reject-reason';

const FREQUENT_REASONS = ['photos', 'data', 'content'] as const;

export interface RejectSheetProps {
  visible: boolean;
  /** La decisión se está enviando: el botón queda bloqueado. */
  submitting: boolean;
  /** Mensaje ya traducido de un fallo del envío (red, motivo no aceptado…), o `null`. */
  failure: string | null;
  /** El motivo, ya recortado y validado. */
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}

/**
 * Hoja inferior para rechazar una vivienda: el motivo es obligatorio (1–1000 caracteres) y los
 * motivos frecuentes son atajos que lo rellenan. Modal: el resto de la pantalla queda fuera del
 * alcance de los lectores de pantalla y el foco vuelve al control que la abrió al cerrarse.
 */
export function RejectSheet({
  visible,
  submitting,
  failure,
  onSubmit,
  onCancel,
}: Readonly<RejectSheetProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const elevation = theme.elevation[3];
  const [text, setText] = useState('');
  const [error, setError] = useState<'required' | 'tooLong' | null>(null);

  const edit = (next: string) => {
    setText(next);
    setError(null);
  };

  const confirm = () => {
    const result = validateReason(text);
    if (result.ok) onSubmit(result.reason);
    else setError(result.error);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={[styles.overlay, { backgroundColor: theme.color.overlay }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboard}
        >
          <View
            role="alertdialog"
            aria-modal
            aria-label={t('admin.reject.title')}
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
                maxWidth: contentMaxWidth.card,
              },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: theme.space[3], padding: theme.space[5] }}
            >
              <Text variant="title" accessibilityRole="header">
                {t('admin.reject.title')}
              </Text>
              <Text tone="textMuted">{t('admin.reject.description')}</Text>
              <Text variant="label">{t('admin.reject.shortcuts')}</Text>
              <View style={[styles.chips, { gap: theme.space[2] }]}>
                {FREQUENT_REASONS.map((key) => {
                  const reason = t(`admin.reject.reasons.${key}`);
                  return (
                    <Chip
                      key={key}
                      label={reason}
                      selected={text === reason}
                      onChange={() => {
                        edit(reason);
                      }}
                    />
                  );
                })}
              </View>
              <TextField
                label={t('admin.reject.reasonLabel')}
                hint={t('admin.reject.reasonHint')}
                value={text}
                onChangeText={edit}
                autoCapitalize="sentences"
                maxLength={REASON_MAX_LENGTH}
                multiline
                error={error ? t(`admin.reject.errors.${error}`) : undefined}
              />
              {failure ? <Notice tone="danger">{failure}</Notice> : null}
              <Button
                variant="danger"
                label={t('admin.reject.confirm')}
                loading={submitting}
                onPress={confirm}
              />
              <Button
                variant="ghost"
                label={t('admin.reject.cancel')}
                disabled={submitting}
                onPress={onCancel}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  keyboard: { alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  overlay: { flex: 1 },
  panel: { maxHeight: '90%', width: '100%' },
});
