import { borderWidth, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '../../ui';

export interface AreaCardProps {
  /** El barrio o zona públicos de la vivienda. */
  areaName: string;
}

/**
 * La ubicación pública de la vivienda: su zona, nunca la dirección postal (RN-08). Es una
 * representación estática y sin claves —un plano esquemático con el pin sobre el nombre de la
 * zona— porque `react-native-maps` exige una clave de Google Maps en Android y no funciona en la
 * web: la misma tarjeta sirve en móvil, web y pruebas. Decorativa para los lectores de pantalla:
 * el grupo entero se anuncia como una frase.
 */
export function AreaCard({ areaName }: Readonly<AreaCardProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const label = `${t('discovery.detail.location.areaLabel', { area: areaName })}. ${t('discovery.detail.location.note')}`;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{
        backgroundColor: theme.color.surface,
        borderColor: theme.color.border,
        borderRadius: theme.radius.lg,
        borderWidth: borderWidth.thin,
        overflow: 'hidden',
      }}
    >
      <View
        style={[styles.plan, { backgroundColor: theme.color.surfaceMuted, gap: theme.space[2] }]}
      >
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.streets,
            { borderColor: theme.color.border, borderWidth: borderWidth.thick },
          ]}
        />
        <Ionicons
          accessible={false}
          name="location"
          size={theme.space[7]}
          color={theme.color.primary}
        />
        <Text variant="heading" accessible={false}>
          {areaName}
        </Text>
      </View>
      <Text tone="textMuted" accessible={false} style={{ padding: theme.space[3] }}>
        {t('discovery.detail.location.note')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plan: { alignItems: 'center', aspectRatio: 16 / 9, justifyContent: 'center', width: '100%' },
  streets: { borderStyle: 'dashed' },
});
