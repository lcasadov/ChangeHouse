import { useTheme } from '@changehouse/ui';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import { ModerationDetailScreen } from './ModerationDetailScreen';
import { useIsAdmin } from './use-is-admin';

/**
 * Pila de la pestaña «Administración»: la cola y el detalle de una vivienda. Quien no tiene el rol
 * `admin` no llega a verla: sus rutas lo devuelven a la pantalla de inicio.
 */
export function AdminStack() {
  const theme = useTheme();
  const isAdmin = useIsAdmin();
  if (!isAdmin) return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.bg } }}
    />
  );
}

/** `/admin/{homeId}`: el detalle de una vivienda pendiente de revisión. */
export function ModerationDetailRoute() {
  const { homeId } = useLocalSearchParams<{ homeId: string }>();
  return <ModerationDetailScreen homeId={homeId} />;
}
