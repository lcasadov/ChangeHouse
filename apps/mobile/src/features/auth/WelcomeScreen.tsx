import { contentMaxWidth, useTheme } from '@changehouse/ui';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AMBIENT, AmbientBackdrop, Button, Text, useBreakpoint } from '../../ui';

/**
 * Bienvenida: fotografía de viviendas a pantalla completa, la promesa del producto y dos toques
 * para empezar. El texto va en blanco sobre el velo; el gesto principal (crear cuenta) queda abajo,
 * al alcance del pulgar.
 */
export function WelcomeScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const margin = breakpoint === 'compact' ? theme.space[5] : theme.space[7];

  return (
    <View style={[styles.root, { backgroundColor: theme.color.secondary }]}>
      <AmbientBackdrop sources={AMBIENT.welcome} />
      <SafeAreaView edges={['top', 'bottom']} style={[styles.safe, { paddingHorizontal: margin }]}>
        <View
          style={[
            styles.content,
            {
              gap: theme.space[6],
              maxWidth: contentMaxWidth.reading,
              paddingVertical: theme.space[6],
            },
          ]}
        >
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[
              styles.mark,
              {
                backgroundColor: theme.color.brand,
                borderRadius: theme.radius.lg,
                gap: theme.space[1],
                padding: theme.space[3],
              },
            ]}
          >
            <Ionicons name="home" size={theme.space[5]} color={theme.color.textOnPhoto} />
            <Ionicons
              name="swap-horizontal"
              size={theme.space[4]}
              color={theme.color.textOnPhoto}
            />
            <Ionicons name="home" size={theme.space[5]} color={theme.color.textOnPhoto} />
          </View>
          <View style={{ gap: theme.space[3] }}>
            <Text variant="display" tone="textOnPhoto" accessibilityRole="header">
              {t('auth.welcome.title')}
            </Text>
            <Text tone="textOnPhoto">{t('auth.welcome.subtitle')}</Text>
          </View>
          <View style={{ gap: theme.space[3] }}>
            <Button
              label={t('auth.welcome.signUp')}
              onPress={() => {
                router.push({ pathname: '/access', params: { mode: 'signUp' } });
              }}
            />
            <Button
              variant="onPhoto"
              label={t('auth.welcome.signIn')}
              onPress={() => {
                router.push({ pathname: '/access', params: { mode: 'signIn' } });
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', width: '100%' },
  mark: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row' },
  root: { flex: 1 },
  safe: { flex: 1, justifyContent: 'flex-end' },
});
