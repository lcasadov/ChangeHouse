import { useTheme } from '@changehouse/ui';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BottomSheet, Button, Notice } from '../../ui';
import type { Preferences } from './preferences';
import { PreferencesFields } from './PreferencesFields';
import { usePreferencesEditor } from './use-preferences-editor';

export interface PreferencesSheetProps {
  visible: boolean;
  title: string;
  /** Las preferencias de partida, o `null` para empezar de cero. */
  initial: Preferences | null;
  /** `true` si la zona se edita aquí (preferencias de una vivienda); en «Explorar» va en la barra. */
  includeZone: boolean;
  /** Guarda el documento entero; rechaza con `SearchPreferencesApiError` si la API lo rechaza. */
  onSave: (input: Preferences) => Promise<void>;
  onClose: () => void;
}

interface BodyProps extends Pick<PreferencesSheetProps, 'initial' | 'includeZone' | 'onSave'> {
  onSaved: () => void;
}

function SheetBody({ initial, includeZone, onSave, onSaved }: Readonly<BodyProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const editor = usePreferencesEditor(initial, onSave);

  return (
    <View style={{ gap: theme.space[4] }}>
      <PreferencesFields
        form={editor.form}
        onChange={editor.setForm}
        errors={editor.errors}
        includeZone={includeZone}
        full
      />
      {editor.errors.general ? <Notice tone="danger">{t('search.sheet.saveFailed')}</Notice> : null}
      <Button
        label={t('search.sheet.save')}
        loading={editor.saving}
        onPress={() => {
          editor
            .submit()
            .then((saved) => {
              if (saved) onSaved();
            })
            .catch(() => undefined);
        }}
      />
    </View>
  );
}

/** Hoja inferior con todos los filtros y la compensación: se abre con los valores actuales cada vez. */
export function PreferencesSheet({
  visible,
  title,
  initial,
  includeZone,
  onSave,
  onClose,
}: Readonly<PreferencesSheetProps>) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      visible={visible}
      title={title}
      closeLabel={t('search.sheet.close')}
      onClose={onClose}
    >
      <SheetBody initial={initial} includeZone={includeZone} onSave={onSave} onSaved={onClose} />
    </BottomSheet>
  );
}
