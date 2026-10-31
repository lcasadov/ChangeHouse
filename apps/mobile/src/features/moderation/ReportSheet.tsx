import { useTheme } from '@changehouse/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BottomSheet, Button, Chip, Notice, Text, TextField } from '../../ui';
import { REPORT_REASON_MAX_LENGTH, validateReportReason } from './report-reason';

const FREQUENT_REASONS = ['fake', 'inappropriate', 'harassment', 'scam'] as const;

export interface ReportSheetProps {
  visible: boolean;
  /** La denuncia se está enviando: el botón queda bloqueado. */
  submitting: boolean;
  /** Mensaje ya traducido de un fallo del envío, o `null`. */
  failure: string | null;
  /** El motivo, ya recortado y validado. */
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}

/**
 * Hoja para denunciar: el motivo es obligatorio (1–1000 caracteres) y los motivos frecuentes son
 * atajos que lo rellenan. Ante un fallo se queda abierta para poder reintentar.
 */
export function ReportSheet({
  visible,
  submitting,
  failure,
  onSubmit,
  onCancel,
}: Readonly<ReportSheetProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [text, setText] = useState('');
  const [error, setError] = useState<'required' | 'tooLong' | null>(null);

  const edit = (next: string) => {
    setText(next);
    setError(null);
  };

  const confirm = () => {
    const result = validateReportReason(text);
    if (result.ok) onSubmit(result.reason);
    else setError(result.error);
  };

  return (
    <BottomSheet
      visible={visible}
      title={t('moderation.report.title')}
      closeLabel={t('moderation.report.cancel')}
      onClose={onCancel}
    >
      <Text tone="textMuted">{t('moderation.report.description')}</Text>
      <Text variant="label">{t('moderation.report.shortcuts')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
        {FREQUENT_REASONS.map((key) => {
          const reason = t(`moderation.report.reasons.${key}`);
          return (
            <Chip
              key={key}
              kind="radio"
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
        label={t('moderation.report.reasonLabel')}
        hint={t('moderation.report.reasonHint')}
        value={text}
        onChangeText={edit}
        autoCapitalize="sentences"
        maxLength={REPORT_REASON_MAX_LENGTH}
        multiline
        error={error ? t(`moderation.report.errors.${error}`) : undefined}
      />
      {failure ? <Notice tone="danger">{failure}</Notice> : null}
      <Button label={t('moderation.report.send')} loading={submitting} onPress={confirm} />
    </BottomSheet>
  );
}
