import { useLocalSearchParams } from 'expo-router';

import { DiscoveryDetailScreen } from './DiscoveryDetailScreen';

/** `/discover/{homeId}`: el detalle de una vivienda ajena, a pantalla completa y fuera de las pestañas. */
export function DiscoverDetailRoute() {
  const { homeId } = useLocalSearchParams<{ homeId: string }>();
  return <DiscoveryDetailScreen homeId={homeId} />;
}
