import { useTheme } from '@changehouse/ui';
import { Stack, useLocalSearchParams } from 'expo-router';

import { HomeDetailScreen } from './HomeDetailScreen';
import { HomeWizard } from './HomeWizard';

/** Pila de la pestaña «Mis casas»: listado, alta, asistente de un borrador y detalle. */
export function HomesStack() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.bg } }}
    />
  );
}

/** `/homes/new`: empieza el alta de una vivienda. */
export function NewHomeRoute() {
  return <HomeWizard />;
}

/** `/homes/{homeId}/edit?step=n`: continúa el asistente de un borrador. */
export function EditHomeRoute() {
  const { homeId, step } = useLocalSearchParams<{ homeId: string; step?: string }>();
  return <HomeWizard homeId={homeId} {...(step ? { step } : {})} />;
}

/** `/homes/{homeId}`: el detalle de una vivienda propia. */
export function HomeDetailRoute() {
  const { homeId } = useLocalSearchParams<{ homeId: string }>();
  return <HomeDetailScreen homeId={homeId} />;
}
