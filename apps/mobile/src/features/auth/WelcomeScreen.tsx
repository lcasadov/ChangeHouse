import { useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '../../ui';

/**
 * Bienvenida: la promesa del producto y dos toques para empezar. El gesto principal (crear cuenta)
 * queda abajo, al alcance del pulgar.
 */
export function WelcomeScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen>
      <View style={[styles.root, { paddingVertical: theme.space[5] }]}>
        <View style={[styles.hero, { gap: theme.space[5] }]}>
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[
              styles.mark,
              {
                backgroundColor: theme.color.brand,
                borderRadius: theme.radius.lg,
                gap: theme.space[2],
                padding: theme.space[5],
              },
            ]}
          >
            <Ionicons name="home" size={theme.space[7]} color={theme.color.textOnPrimary} />
            <Ionicons
              name="swap-horizontal"
              size={theme.space[6]}
              color={theme.color.textOnPrimary}
            />
            <Ionicons name="home" size={theme.space[7]} color={theme.color.textOnPrimary} />
          </View>
          <Text variant="display" accessibilityRole="header">
            {t('auth.welcome.title')}
          </Text>
          <Text tone="textMuted">{t('auth.welcome.subtitle')}</Text>
        </View>
        <View style={{ gap: theme.space[2] }}>
          <Button
            label={t('auth.welcome.signUp')}
            onPress={() => {
              router.push({ pathname: '/access', params: { mode: 'signUp' } });
            }}
          />
          <Button
            variant="ghost"
            label={t('auth.welcome.signIn')}
            onPress={() => {
              router.push({ pathname: '/access', params: { mode: 'signIn' } });
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center' },
  mark: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row' },
  root: { flex: 1 },
});
