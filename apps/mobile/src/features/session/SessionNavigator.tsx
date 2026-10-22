import { useTheme } from '@changehouse/ui';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '../../ui';
import { VerifyEmailBanner } from '../auth/VerifyEmailBanner';
import { LoadingView } from './LoadingView';
import type { SessionState } from './session-state';
import { useSession } from './use-session';

/** Estados en los que se sabe a qué parte de la app pertenece la persona. */
type Destination = Extract<SessionState, 'signedOut' | 'unregistered' | 'ready'>;

const isDestination = (state: SessionState): state is Destination =>
  state === 'signedOut' || state === 'unregistered' || state === 'ready';

/**
 * Protección de rutas: sin sesión solo existe el acceso, sin alta solo el alta y con alta solo las
 * pestañas. Una ruta fuera de la parte que le toca redirige a la primera disponible.
 */
export function SessionNavigator() {
  const theme = useTheme();
  const { state, retry } = useSession();
  // La parte de la app que se enseña no cambia mientras se consulta: así la navegación no se reinicia
  const [destination, setDestination] = useState<Destination | null>(null);
  if (isDestination(state) && state !== destination) setDestination(state);

  if (destination === null) {
    return state === 'error' ? <LoadError onRetry={retry} /> : <LoadingView />;
  }

  const covered = state === 'loading' || state === 'error';
  return (
    <View style={[styles.root, { backgroundColor: theme.color.bg }]}>
      {destination === 'ready' ? <VerifyEmailBanner /> : null}
      <View
        style={styles.root}
        importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={covered}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={destination === 'signedOut'}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={destination === 'unregistered'}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
          <Stack.Protected guard={destination === 'ready'}>
            <Stack.Screen name="(tabs)" />
          </Stack.Protected>
        </Stack>
      </View>
      {covered ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.color.bg }]}>
          {state === 'error' ? <LoadError onRetry={retry} /> : <LoadingView />}
        </View>
      ) : null}
    </View>
  );
}

function LoadError({ onRetry }: Readonly<{ onRetry: () => void }>) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title={t('session.error.title')}
      description={t('session.error.description')}
      action={{ label: t('session.error.retry'), onPress: onRetry }}
    />
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
