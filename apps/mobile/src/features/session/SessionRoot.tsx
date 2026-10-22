import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import type { AppServices } from './services';
import { SessionNavigator } from './SessionNavigator';
import { SessionProviders } from './SessionProviders';

/**
 * Raíz de la sesión: servicios, estado de acceso y la navegación protegida por él. Todo cuelga de
 * la raíz de gestos, que react-native-gesture-handler exige para reconocer el deslizamiento de las tarjetas.
 */
export function SessionRoot({ services }: Readonly<{ services: AppServices }>) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SessionProviders services={services}>
        <SessionNavigator />
      </SessionProviders>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
