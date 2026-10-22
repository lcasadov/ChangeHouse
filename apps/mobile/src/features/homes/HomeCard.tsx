import { borderWidth, useTheme } from '@changehouse/ui';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Badge, Button, Text } from '../../ui';
import { useFocusRing } from '../../ui/useFocusRing';
import { formatEuros } from './home-form';
import { primaryActionOf, STATUS_PRESENTATION } from './home-status';
import { HomeCover } from './HomeCover';
import type { Home } from './homes-api';

export interface HomeCardProps {
  home: Home;
  /** Abre la ficha de la vivienda. */
  onOpen: () => void;
  /** La acción principal del estado: continuar el asistente, enviar a revisión o ver. */
  onPrimary: () => void;
}

/** El título de una vivienda: su tipo y su barrio o zona, que es lo único público de su ubicación. */
export function useHomeTitle(home: Home): string {
  const { t } = useTranslation();
  return t('homes.card.title', {
    type: t(`homes.type.${home.type}`),
    area: home.location.areaName,
  });
}

/** Tarjeta de «Mis casas»: foto grande, título, estado con texto e icono y la acción principal. */
export function HomeCard({ home, onOpen, onPrimary }: Readonly<HomeCardProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const focusRing = useFocusRing();
  const title = useHomeTitle(home);
  const { tone, icon } = STATUS_PRESENTATION[home.status];
  const statusLabel = t(`homes.status.${home.status}`);
  const action = primaryActionOf(home);
  const actionLabel = t(`homes.actions.${action.kind}`);
  const hasValue = home.valueMinCents !== null && home.valueMaxCents !== null;

  return (
    <View
      style={{
        backgroundColor: theme.color.surface,
        borderColor: theme.color.border,
        borderRadius: theme.radius.lg,
        borderWidth: borderWidth.thin,
        gap: theme.space[3],
        padding: theme.space[3],
      }}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('homes.card.open', { title })}
        accessibilityValue={{ text: statusLabel }}
        onPress={onOpen}
        onFocus={focusRing.onFocus}
        onBlur={focusRing.onBlur}
        style={[{ gap: theme.space[3] }, focusRing.style]}
      >
        <HomeCover home={home} title={title} decorative />
        <Text variant="heading">{title}</Text>
        <Badge tone={tone} icon={icon} label={statusLabel} />
        <Text tone="textMuted">
          {hasValue
            ? t('homes.card.value', {
                min: formatEuros(home.valueMinCents ?? 0),
                max: formatEuros(home.valueMaxCents ?? 0),
              })
            : t('homes.card.noValue')}
        </Text>
      </Pressable>
      <Button
        variant={action.kind === 'view' ? 'secondary' : 'primary'}
        label={actionLabel}
        accessibilityLabel={t('homes.card.action', { action: actionLabel, title })}
        onPress={onPrimary}
      />
    </View>
  );
}
