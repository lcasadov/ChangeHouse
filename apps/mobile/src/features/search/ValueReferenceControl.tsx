import { borderWidth, useTheme } from '@changehouse/ui';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, FieldError, Text } from '../../ui';

const STEP = 10;
const MIN = 0;
const MAX = 100;

export interface ValueReferenceControlProps {
  /** Punto del rango de valor de la vivienda, de 0 (mínimo) a 100 (máximo). */
  value: number;
  onChange: (value: number) => void;
  error?: string | undefined;
}

const clamp = (value: number) => Math.min(MAX, Math.max(MIN, value));

/**
 * Punto del rango de valor con el que se calcula la compensación, en pasos de 10 (RN-03). Es un
 * ajustador con botones de bajar y subir —alcanzable por teclado y lector de pantalla sin gestos— y
 * una barra que muestra la posición; se explica en una línea. Sustituye al control deslizante para no
 * añadir una dependencia nativa (ver `design.md`).
 */
export function ValueReferenceControl({
  value,
  onChange,
  error,
}: Readonly<ValueReferenceControlProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const shown = t('search.valueReference.value', { pct: value });

  return (
    <View style={{ gap: theme.space[2] }}>
      <Text variant="label">{t('search.valueReference.label')}</Text>
      <View style={[styles.row, { gap: theme.space[3] }]}>
        <Button
          variant="secondary"
          label="−"
          accessibilityLabel={t('search.valueReference.lower')}
          disabled={value <= MIN}
          onPress={() => {
            onChange(clamp(value - STEP));
          }}
        />
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('search.valueReference.label')}
          accessibilityValue={{ min: MIN, max: MAX, now: value, text: shown }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={({ nativeEvent }) => {
            onChange(clamp(value + (nativeEvent.actionName === 'increment' ? STEP : -STEP)));
          }}
          style={[styles.track, { gap: theme.space[1] }]}
        >
          <Text variant="bodyStrong" style={styles.centered}>
            {shown}
          </Text>
          <View
            style={{
              backgroundColor: theme.color.surfaceMuted,
              borderColor: theme.color.borderStrong,
              borderRadius: theme.radius.full,
              borderWidth: borderWidth.thin,
              height: theme.space[3],
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                backgroundColor: theme.color.primary,
                height: theme.space[3],
                width: `${String(value)}%`,
              }}
            />
          </View>
        </View>
        <Button
          variant="secondary"
          label="+"
          accessibilityLabel={t('search.valueReference.higher')}
          disabled={value >= MAX}
          onPress={() => {
            onChange(clamp(value + STEP));
          }}
        />
      </View>
      <Text variant="caption" tone="textMuted">
        {t('search.valueReference.explanation')}
      </Text>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { textAlign: 'center' },
  row: { alignItems: 'center', flexDirection: 'row' },
  track: { flex: 1 },
});
