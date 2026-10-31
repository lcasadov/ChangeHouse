import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BottomSheet, Button, Notice, Text, TextField } from '../../ui';
import { NOTE_MAX_LENGTH, validateNote } from './resolution-note';

export interface ResolveReportSheetProps {
  /** Cómo se cierra la denuncia; decide el título y el botón. */
  action: 'resolve' | 'dismiss';
  visible: boolean;
  /** La decisión se está enviando: el botón queda bloqueado. */
  submitting: boolean;
  /** Mensaje ya traducido de un fallo del envío, o `null`. */
  failure: string | null;
  /** La nota, ya recortada y validada. */
  onSubmit: (note: string) => void;
  onCancel: () => void;
}

/**
 * Hoja para resolver o desestimar una denuncia: la nota es obligatoria (1–2000 caracteres) y queda
 * en el registro de auditoría. El contrato no la exige, pero una revisión sin nota no se puede auditar.
 */
export function ResolveReportSheet({
  action,
  visible,
  submitting,
  failure,
  onSubmit,
  onCancel,
}: Readonly<ResolveReportSheetProps>) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [error, setError] = useState<'required' | 'tooLong' | null>(null);

  const confirm = () => {
    const result = validateNote(text);
    if (result.ok) onSubmit(result.note);
    else setError(result.error);
  };

  return (
    <BottomSheet
      visible={visible}
      title={t(`admin.reports.${action}.title`)}
      closeLabel={t('admin.reports.note.cancel')}
      onClose={onCancel}
    >
      <Text tone="textMuted">{t('admin.reports.note.description')}</Text>
      <TextField
        label={t('admin.reports.note.label')}
        hint={t('admin.reports.note.hint')}
        value={text}
        onChangeText={(next) => {
          setText(next);
          setError(null);
        }}
        autoCapitalize="sentences"
        maxLength={NOTE_MAX_LENGTH}
        multiline
        error={error ? t(`admin.reports.note.errors.${error}`) : undefined}
      />
      {failure ? <Notice tone="danger">{failure}</Notice> : null}
      <Button
        variant={action === 'dismiss' ? 'secondary' : 'primary'}
        label={t(`admin.reports.${action}.confirm`)}
        loading={submitting}
        onPress={confirm}
      />
    </BottomSheet>
  );
}
