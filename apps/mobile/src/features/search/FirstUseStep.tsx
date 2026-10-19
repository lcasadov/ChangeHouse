import { useTranslation } from 'react-i18next';

import { Button, FormScreen, Notice, Text } from '../../ui';
import type { Preferences } from './preferences';
import { PreferencesFields } from './PreferencesFields';
import { usePreferencesEditor } from './use-preferences-editor';

export interface FirstUseStepProps {
  /** Guarda el documento entero; rechaza con `SearchPreferencesApiError` si la API lo rechaza. */
  onSave: (input: Preferences) => Promise<void>;
}

/**
 * Primer uso de «Explorar» (`docs/style-guide.md` §0): zona y compensación, lo único imprescindible,
 * antes de cualquier tarjeta. El resto de filtros se afinan después con un toque.
 */
export function FirstUseStep({ onSave }: Readonly<FirstUseStepProps>) {
  const { t } = useTranslation();
  const editor = usePreferencesEditor(null, onSave);

  return (
    <FormScreen>
      <Text variant="title" accessibilityRole="header">
        {t('search.firstUse.title')}
      </Text>
      <Text tone="textMuted">{t('search.firstUse.description')}</Text>
      <PreferencesFields
        form={editor.form}
        onChange={editor.setForm}
        errors={editor.errors}
        includeZone
        full={false}
      />
      {editor.errors.general ? <Notice tone="danger">{t('search.sheet.saveFailed')}</Notice> : null}
      <Button
        label={t('search.firstUse.action')}
        loading={editor.saving}
        onPress={() => {
          editor.submit().catch(() => undefined);
        }}
      />
    </FormScreen>
  );
}
