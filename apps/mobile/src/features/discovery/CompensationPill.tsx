import type { ColorTokens } from '@changehouse/ui';
import { useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '../../ui';
import { formatEuros } from '../homes/home-form';
import type { Compensation, CompensationKind } from './discovery-api';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Token de color e icono de cada tipo: el icono y el texto dicen lo mismo que el color. */
const PILLS: Record<CompensationKind, { token: keyof ColorTokens; icon: IconName }> = {
  receive: { token: 'compensationReceive', icon: 'arrow-down-circle' },
  pay: { token: 'compensationPay', icon: 'arrow-up-circle' },
  fair: { token: 'compensationEven', icon: 'swap-horizontal' },
};

/** «Tú recibes 8.000 €», «Tú pagas 12.000 €» o «Cambio justo» (sin importe: no hay diferencia que pagar). */
export function compensationText(t: TFunction, compensation: Compensation): string {
  return compensation.kind === 'fair'
    ? t('discovery.compensation.fair')
    : t(`discovery.compensation.${compensation.kind}`, {
        amount: formatEuros(compensation.amountCents),
      });
}

/** La píldora del diferencial del producto: lo que cuesta o aporta el cambio, a simple vista. */
export function CompensationPill({ compensation }: Readonly<{ compensation: Compensation }>) {
  const theme = useTheme();
  const { token, icon } = PILLS[compensation.kind];
  const { t } = useTranslation();

  return (
    <View
      testID="compensation-pill"
      style={[
        styles.pill,
        {
          backgroundColor: theme.color[token],
          borderRadius: theme.radius.full,
          gap: theme.space[1],
          paddingHorizontal: theme.space[3],
          paddingVertical: theme.space[1],
        },
      ]}
    >
      <Ionicons
        accessible={false}
        name={icon}
        size={theme.font.label.lineHeight}
        color={theme.color.textOnPrimary}
      />
      <Text variant="bodyStrong" tone="textOnPrimary" accessible={false}>
        {compensationText(t, compensation)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row' },
});
