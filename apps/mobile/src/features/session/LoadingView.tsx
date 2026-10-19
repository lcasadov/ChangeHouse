import { useTheme } from '@changehouse/ui';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/** Pantalla de espera a pantalla completa mientras se restaura la sesión o se consulta la cuenta. */
export function LoadingView() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('session.loading')}
      accessibilityLiveRegion="polite"
      style={[styles.root, { backgroundColor: theme.color.bg }]}
    >
      <ActivityIndicator size="large" color={theme.color.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
