import { borderWidth, touchTarget, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { FieldError, Notice, Text, TextField } from '../../ui';
import { useFocusRing } from '../../ui/useFocusRing';
import {
  addMunicipality,
  type Preferences,
  removeZone,
  withCenter,
  type ZoneRef,
} from './preferences';
import { useZoneSearch } from './use-zone-search';
import type { ZoneSuggestion } from './zone-suggestions';

export interface ZonePickerProps {
  preferences: Preferences;
  /** El documento con la zona cambiada. */
  onChange: (next: Preferences) => void;
  /** Mensaje de error ya traducido, junto al campo. */
  error?: string | undefined;
}

const centerKey = (center: { lat: number; lng: number }) =>
  `${String(center.lat)},${String(center.lng)}`;

interface ZoneTagProps {
  label: string;
  onRemove: () => void;
}

/** Una zona elegida, con su botón para quitarla (objetivo táctil completo, nombre accesible). */
function ZoneTag({ label, onRemove }: Readonly<ZoneTagProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const focusRing = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('search.zone.remove', { name: label })}
      onPress={onRemove}
      onFocus={focusRing.onFocus}
      onBlur={focusRing.onBlur}
      style={[
        styles.tag,
        {
          backgroundColor: theme.color.surfaceMuted,
          borderColor: theme.color.borderStrong,
          borderRadius: theme.radius.full,
          borderWidth: borderWidth.thin,
          gap: theme.space[2],
          minHeight: touchTarget,
          paddingHorizontal: theme.space[3],
        },
        focusRing.style,
      ]}
    >
      <Text variant="label" accessible={false}>
        {label}
      </Text>
      <Ionicons accessible={false} name="close" size={theme.space[4]} color={theme.color.text} />
    </Pressable>
  );
}

interface SuggestionRowProps {
  suggestion: ZoneSuggestion;
  onPick: () => void;
}

function SuggestionRow({ suggestion, onPick }: Readonly<SuggestionRowProps>) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={suggestion.label}
      onPress={onPick}
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
        name={suggestion.kind === 'municipality' ? 'business-outline' : 'location-outline'}
        size={theme.space[5]}
        color={theme.color.primary}
      />
      <Text accessible={false} style={styles.suggestionText}>
        {suggestion.label}
      </Text>
    </Pressable>
  );
}

/**
 * La barra «¿Dónde quieres vivir?»: se escribe un sitio, se elige una sugerencia y queda como zona
 * (un municipio entero o un barrio con su radio). Las zonas elegidas se quitan con un toque.
 */
export function ZonePicker({ preferences, onChange, error }: Readonly<ZonePickerProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [text, setText] = useState('');
  // La API solo guarda el punto, no su nombre: se recuerda aquí mientras dure la pantalla
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({});
  const search = useZoneSearch(text);

  const pick = (suggestion: ZoneSuggestion) => {
    if (suggestion.kind === 'municipality') {
      onChange(addMunicipality(preferences, suggestion.label));
    } else {
      setPlaceNames((names) => ({ ...names, [centerKey(suggestion.center)]: suggestion.label }));
      onChange(withCenter(preferences, suggestion.center));
    }
    setText('');
  };

  const tags: { ref: ZoneRef; label: string }[] = [
    ...(preferences.municipalities ?? []).map((name) => ({
      ref: { kind: 'municipality', name } satisfies ZoneRef,
      label: name,
    })),
  ];
  if (preferences.center && preferences.radiusKm) {
    const km = String(preferences.radiusKm);
    const name = placeNames[centerKey(preferences.center)];
    tags.push({
      ref: { kind: 'center' },
      label: name ? t('search.zone.around', { name, km }) : t('search.zone.point', { km }),
    });
  }

  return (
    <View style={{ gap: theme.space[2] }}>
      <TextField
        label={t('search.bar.label')}
        hint={t('search.bar.hint')}
        value={text}
        onChangeText={setText}
        autoComplete="off"
        autoCapitalize="words"
      />
      {search.status === 'searching' ? (
        <Text variant="caption" tone="textMuted" accessibilityLiveRegion="polite">
          {t('search.bar.searching')}
        </Text>
      ) : null}
      {search.status === 'ready' && search.suggestions.length === 0 ? (
        <Text tone="textMuted" accessibilityLiveRegion="polite">
          {t('search.bar.noResults')}
        </Text>
      ) : null}
      {search.status === 'error' ? <Notice tone="warning">{t('search.bar.failed')}</Notice> : null}
      {search.status === 'ready'
        ? search.suggestions.map((suggestion) => (
            <SuggestionRow
              key={suggestion.id}
              suggestion={suggestion}
              onPick={() => {
                pick(suggestion);
              }}
            />
          ))
        : null}
      {tags.length > 0 ? (
        <View
          accessibilityLabel={t('search.zone.selected')}
          style={[styles.tags, { gap: theme.space[2] }]}
        >
          {tags.map(({ ref, label }) => (
            <ZoneTag
              key={ref.kind === 'center' ? 'center' : ref.name}
              label={label}
              onRemove={() => {
                onChange(removeZone(preferences, ref));
              }}
            />
          ))}
        </View>
      ) : null}
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  suggestion: { alignItems: 'center', flexDirection: 'row' },
  suggestionText: { flex: 1 },
  tag: { alignItems: 'center', flexDirection: 'row' },
  tags: { flexDirection: 'row', flexWrap: 'wrap' },
});
