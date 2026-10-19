import { useTheme } from '@changehouse/ui';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, EmptyState, Screen } from '../../ui';
import { useSignOut } from '../auth/use-sign-out';

/**
 * Perfil provisional hasta `add-user-profile`: explica qué habrá y ofrece cerrar sesión, que no puede
 * faltar desde el primer día.
 */
export function ProfileScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const signOut = useSignOut();

  return (
    <Screen>
      <EmptyState
        icon="person-outline"
        title={t('profile.empty.title')}
        description={t('profile.empty.description')}
      />
      <View style={[styles.actions, { paddingBottom: theme.space[5] }]}>
        <Button
          variant="secondary"
          label={t('auth.signOut')}
          onPress={() => {
            signOut().catch(() => undefined);
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ actions: { width: '100%' } });
