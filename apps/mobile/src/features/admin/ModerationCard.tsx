import { borderWidth, useTheme } from '@changehouse/ui';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '../../ui';
import { useFocusRing } from '../../ui/useFocusRing';
import { useHomeTitle } from '../homes/HomeCard';
import { HomeCover } from '../homes/HomeCover';
import type { Home } from '../homes/homes-api';
import { formatDate } from './format-date';

export interface ModerationCardProps {
  home: Home;
  onOpen: () => void;
}

/** Tarjeta de la cola: portada, tipo y zona, y cuándo se dio de alta. Se abre entera. */
export function ModerationCard({ home, onOpen }: Readonly<ModerationCardProps>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const focusRing = useFocusRing();
  const title = useHomeTitle(home);

  return (
    <View
      style={{
        backgroundColor: theme.color.surface,
        borderColor: theme.color.border,
        borderRadius: theme.radius.lg,
        borderWidth: borderWidth.thin,
        padding: theme.space[3],
      }}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('admin.queue.open', { title })}
        onPress={onOpen}
        onFocus={focusRing.onFocus}
        onBlur={focusRing.onBlur}
        style={[{ gap: theme.space[3] }, focusRing.style]}
      >
        <HomeCover home={home} title={title} decorative />
        <Text variant="heading">{title}</Text>
        {home.createdAt ? (
          <Text tone="textMuted">
            {t('admin.queue.created', { date: formatDate(home.createdAt) })}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}
