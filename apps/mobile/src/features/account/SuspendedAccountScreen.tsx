import { useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Link, Screen, Text } from '../../ui';
import { useSignOut } from '../auth/use-sign-out';
import { useServices } from '../session/services';
import { AccountActions } from './AccountActions';

/**
 * Pantalla de una cuenta suspendida por un admin: el motivo general (nunca el interno), cómo
 * contactar, exportar sus datos, eliminar su cuenta y cerrar sesión. Es lo único que puede hacer:
 * la API le deniega el resto. La exportación y la eliminación son las mismas de «Perfil».
 */
export function SuspendedAccountScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { legalUrls } = useServices();
  const signOut = useSignOut();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { gap: theme.space[4], paddingVertical: theme.space[6] },
        ]}
      >
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[
            styles.icon,
            {
              backgroundColor: theme.color.surfaceMuted,
              borderRadius: theme.radius.full,
              padding: theme.space[5],
            },
          ]}
        >
          <Ionicons name="lock-closed-outline" size={theme.space[7]} color={theme.color.primary} />
        </View>
        <Text variant="title" accessibilityRole="header" style={styles.centered}>
          {t('account.suspended.title')}
        </Text>
        <Text tone="textMuted" style={styles.centered}>
          {t('account.suspended.reason')}
        </Text>
        <Text style={styles.centered}>{t('account.suspended.contact')}</Text>
        <View style={styles.icon}>
          <Link label={t('account.suspended.contactLink')} href={legalUrls.privacy} />
        </View>
        <AccountActions />
        <Button
          variant="secondary"
          label={t('auth.signOut')}
          onPress={() => {
            signOut().catch(() => undefined);
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { textAlign: 'center' },
  content: { flexGrow: 1, justifyContent: 'center' },
  icon: { alignSelf: 'center' },
});
