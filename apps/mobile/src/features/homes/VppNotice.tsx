import type { HomeRegime } from '@changehouse/shared';
import { isProtectedRegime } from '@changehouse/shared';
import { borderWidth, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '../../ui';
import { formatEuros } from './home-form';

export interface VppNoticeProps {
  regime: HomeRegime;
  /** Precio máximo legal, si se conoce. */
  maxLegalPriceCents: number | null | undefined;
}

/**
 * Aviso informativo de una vivienda protegida (RN-06): su régimen, el precio máximo legal si se
 * conoce, la necesidad de visado o autorización y los requisitos de quien la reciba. El tanteo y
 * retracto en permutas figura como pendiente de confirmar. Orientativo: no calcula nada. Una
 * vivienda libre no lo muestra.
 */
export function VppNotice({ regime, maxLegalPriceCents }: Readonly<VppNoticeProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  if (!isProtectedRegime(regime)) return null;

  const price =
    maxLegalPriceCents === null || maxLegalPriceCents === undefined
      ? t('homes.vpp.maxLegalPriceUnknown')
      : t('homes.vpp.maxLegalPrice', { amount: formatEuros(maxLegalPriceCents) });
  const lines = [
    price,
    t('homes.vpp.authorization'),
    t('homes.vpp.requirements'),
    t('homes.vpp.rightOfFirstRefusal'),
  ];

  return (
    <View
      testID="vpp-notice"
      style={{
        backgroundColor: theme.color.surface,
        borderColor: theme.color.secondary,
        borderRadius: theme.radius.md,
        borderWidth: borderWidth.thin,
        gap: theme.space[2],
        padding: theme.space[3],
      }}
    >
      <View style={[styles.row, { gap: theme.space[2] }]}>
        <Ionicons
          name="shield-checkmark-outline"
          size={theme.space[5]}
          color={theme.color.secondary}
        />
        <Text variant="bodyStrong" accessibilityRole="header" style={styles.title}>
          {t('homes.vpp.title', { regime: t(`homes.regime.${regime}`) })}
        </Text>
      </View>
      {lines.map((line) => (
        <Text key={line}>{line}</Text>
      ))}
      <Text variant="caption" tone="textMuted">
        {t('homes.vpp.disclaimer')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row' },
  title: { flexShrink: 1 },
});
