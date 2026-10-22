import { useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  icon?: ComponentProps<typeof Ionicons>['name'];
  /** Por qué no hay nada. */
  title: string;
  /** Qué hacer a continuación o qué habrá aquí. */
  description: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, description, action }: Readonly<EmptyStateProps>) {
  const theme = useTheme();

  return (
    <View style={[styles.root, { gap: theme.space[3], padding: theme.space[5] }]}>
      {icon ? (
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
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { textAlign: 'center' },
  root: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
