import { CHAT_MESSAGE_MAX_LENGTH } from '@changehouse/shared';
import { borderWidth, disabledOpacity, touchTarget, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, FieldError, Notice, Text } from '../../ui';
import { useFocusRing } from '../../ui/useFocusRing';
import { draftStateOf, formatCount } from './chat-model';
import type { AttachFailure } from './use-chat-outbox';

export interface ComposerProps {
  onSend: (text: string) => void;
  onAttach: () => void;
  /** La galería está abierta: adjuntar queda deshabilitado hasta que se cierre. */
  attaching: boolean;
  attachFailure: AttachFailure | null;
}

function AttachButton({ disabled, onPress }: Readonly<{ disabled: boolean; onPress: () => void }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const focusRing = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('chat.composer.attach')}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={focusRing.onFocus}
      onBlur={focusRing.onBlur}
      style={[
        styles.attach,
        {
          borderRadius: theme.radius.full,
          minHeight: touchTarget,
          minWidth: touchTarget,
          opacity: disabled ? disabledOpacity : 1,
        },
        focusRing.style,
      ]}
    >
      <Ionicons
        accessible={false}
        name="image-outline"
        size={theme.space[5]}
        color={theme.color.primary}
      />
    </Pressable>
  );
}

/**
 * Donde se escribe: adjuntar una imagen, el campo de texto (que crece con lo escrito) y «Enviar».
 * Cuenta los caracteres y, pasado el máximo de la API, lo dice y no deja enviar.
 */
export function Composer({ onSend, onAttach, attaching, attachFailure }: Readonly<ComposerProps>) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const focusRing = useFocusRing();
  const [draft, setDraft] = useState('');
  const state = draftStateOf(draft);
  const max = formatCount(CHAT_MESSAGE_MAX_LENGTH, i18n.language);

  const submit = () => {
    if (state !== 'ok') return;
    onSend(draft);
    setDraft('');
  };

  return (
    <View
      style={{
        backgroundColor: theme.color.surface,
        borderColor: theme.color.border,
        borderTopWidth: borderWidth.thin,
        gap: theme.space[2],
        padding: theme.space[3],
      }}
    >
      {attachFailure ? <Notice tone="warning">{t(`chat.attach.${attachFailure}`)}</Notice> : null}
      <View style={[styles.row, { gap: theme.space[2] }]}>
        <AttachButton disabled={attaching} onPress={onAttach} />
        <TextInput
          multiline
          value={draft}
          onChangeText={setDraft}
          onFocus={focusRing.onFocus}
          onBlur={focusRing.onBlur}
          accessibilityLabel={t('chat.composer.label')}
          placeholder={t('chat.composer.label')}
          placeholderTextColor={theme.color.textMuted}
          aria-invalid={state === 'too-long'}
          style={[
            styles.input,
            {
              backgroundColor: theme.color.bg,
              borderColor: state === 'too-long' ? theme.color.danger : theme.color.borderStrong,
              borderRadius: theme.radius.md,
              borderWidth: borderWidth.thin,
              color: theme.color.text,
              fontFamily: theme.font.body.family,
              fontSize: theme.font.body.size,
              maxHeight: touchTarget * 3,
              minHeight: touchTarget,
              paddingHorizontal: theme.space[3],
              paddingVertical: theme.space[2],
            },
            focusRing.style,
          ]}
        />
        <Button label={t('chat.composer.send')} disabled={state !== 'ok'} onPress={submit} />
      </View>
      {draft.length > 0 ? (
        <View style={[styles.row, styles.between, { gap: theme.space[2] }]}>
          <View style={styles.error}>
            {state === 'too-long' ? (
              <FieldError message={t('chat.composer.tooLong', { max })} />
            ) : null}
          </View>
          <Text variant="caption" tone="textMuted">
            {t('chat.composer.counter', {
              length: formatCount(draft.trim().length, i18n.language),
              max,
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  attach: { alignItems: 'center', justifyContent: 'center' },
  between: { justifyContent: 'space-between' },
  error: { flex: 1 },
  input: { flex: 1, textAlignVertical: 'top' },
  row: { alignItems: 'flex-end', flexDirection: 'row' },
});
