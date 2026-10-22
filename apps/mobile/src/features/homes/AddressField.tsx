import { borderWidth, touchTarget, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Notice, Text, TextField } from '../../ui';
import { useServices } from '../session/services';
import type { AddressSuggestion } from './address-suggestions';
import type { AddressChoice } from './home-form';
import { useAddressSearch } from './use-address-search';

export interface AddressFieldProps {
  /** La dirección elegida de las sugerencias, o `null` si aún no se ha elegido ninguna. */
  value: AddressChoice | null;
  /** Dirección ya guardada en el borrador: se muestra mientras no se cambie. */
  savedAddress?: string | undefined;
  onChange: (choice: AddressChoice | null) => void;
  error?: string | undefined;
}

/**
 * Dirección con autocompletado: se escribe, se elige una sugerencia y solo entonces cuenta como
 * dirección. Editar el texto tras elegir descarta la elección, para que `value` y lo que se ve
 * nunca discrepen. Sin resultados y con fallo del servicio se explican.
 */
export function AddressField({
  value,
  savedAddress,
  onChange,
  error,
}: Readonly<AddressFieldProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { addressSuggestions } = useServices();
  const [text, setText] = useState(value?.formatted ?? savedAddress ?? '');
  const settled = text === (value?.formatted ?? savedAddress);
  const search = useAddressSearch(text, !settled);

  const pick = (suggestion: AddressSuggestion) => {
    addressSuggestions.endSession();
    setText(suggestion.formatted);
    onChange(suggestion);
  };

  return (
    <View style={{ gap: theme.space[2] }}>
      <TextField
        label={t('homes.form.address')}
        hint={t('homes.form.addressHint')}
        value={text}
        onChangeText={(next) => {
          setText(next);
          if (value && next !== value.formatted) onChange(null);
        }}
        autoComplete="off"
        autoCapitalize="words"
        error={error}
      />
      {search.status === 'searching' ? (
        <Text variant="caption" tone="textMuted" accessibilityLiveRegion="polite">
          {t('homes.form.addressSearching')}
        </Text>
      ) : null}
      {search.status === 'ready' && search.suggestions.length === 0 ? (
        <Text tone="textMuted" accessibilityLiveRegion="polite">
          {t('homes.form.addressNoResults')}
        </Text>
      ) : null}
      {search.status === 'error' ? (
        <Notice tone="warning">{t('homes.form.addressSearchFailed')}</Notice>
      ) : null}
      {search.status === 'ready'
        ? search.suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.placeId}
              accessibilityRole="button"
              accessibilityLabel={suggestion.formatted}
              onPress={() => {
                pick(suggestion);
              }}
              style={[
                styles.suggestion,
                {
                  backgroundColor: theme.color.surface,
                  borderColor: theme.color.border,
                  borderRadius: theme.radius.md,
                  borderWidth: borderWidth.thin,
                  gap: theme.space[2],
                  minHeight: touchTarget,
                  padding: theme.space[3],
                },
              ]}
            >
              <Ionicons
                accessible={false}
                name="location-outline"
                size={theme.space[5]}
                color={theme.color.primary}
              />
              <Text accessible={false} style={styles.suggestionText}>
                {suggestion.formatted}
              </Text>
            </Pressable>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  suggestion: { alignItems: 'center', flexDirection: 'row' },
  suggestionText: { flex: 1 },
});
