import { useTheme } from '@changehouse/ui';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/**
 * Marcador de la tarjeta mientras se buscan casas: ocupa el mismo sitio que la tarjeta para que la
 * pantalla no salte al llegar los datos, y se anuncia como una espera.
 */
export function FeedPlaceholder() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('discovery.loading')}
      accessibilityLiveRegion="polite"
      style={[
        styles.root,
        { backgroundColor: theme.color.surfaceMuted, borderRadius: theme.radius.lg },
      ]}
    >
      <ActivityIndicator size="large" color={theme.color.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
