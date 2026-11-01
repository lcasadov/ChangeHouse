import { space, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AmbientSource } from './ambient';
import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  icon?: ComponentProps<typeof Ionicons>['name'];
  /** Imagen de ambiente decorativa; si se indica, sustituye al icono. */
  image?: AmbientSource;
  /** Por qué no hay nada. */
  title: string;
  /** Qué hacer a continuación o qué habrá aquí. */
  description: string;
  action?: { label: string; onPress: () => void };
  /** Una alternativa a la acción principal, con menos peso visual. */
  secondaryAction?: { label: string; onPress: () => void };
}

export function EmptyState({
  icon,
  image,
  title,
  description,
  action,
  secondaryAction,
}: Readonly<EmptyStateProps>) {
  const theme = useTheme();

  return (
    <View style={[styles.root, { gap: theme.space[3], padding: theme.space[5] }]}>
      {image ? (
        <View
          testID="empty-state-image"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={{
            borderRadius: theme.radius.full,
            height: IMAGE_SIZE,
            overflow: 'hidden',
            width: IMAGE_SIZE,
          }}
        >
          <Image source={image} contentFit="cover" style={StyleSheet.absoluteFill} />
        </View>
      ) : null}
      {icon && !image ? (
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={{
            backgroundColor: theme.color.surfaceMuted,
            borderRadius: theme.radius.full,
            padding: theme.space[5],
          }}
        >
          <Ionicons name={icon} size={theme.space[7]} color={theme.color.primary} />
        </View>
      ) : null}
      <Text variant="title" accessibilityRole="header" style={styles.centered}>
        {title}
      </Text>
      <Text tone="textMuted" style={styles.centered}>
        {description}
      </Text>
      {action ? <Button label={action.label} onPress={action.onPress} /> : null}
      {secondaryAction ? (
        <Button
          variant="secondary"
          label={secondaryAction.label}
          onPress={secondaryAction.onPress}
        />
      ) : null}
    </View>
  );
}

/** 160 px: la imagen manda sobre el texto sin desplazar la acción fuera de la pantalla. */
const IMAGE_SIZE = space[8] * 2.5;

const styles = StyleSheet.create({
  centered: { textAlign: 'center' },
  root: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
