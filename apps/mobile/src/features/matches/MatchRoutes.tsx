import { useLocalSearchParams } from 'expo-router';

import { MatchDetailScreen } from './MatchDetailScreen';

/** `/match/{matchId}`: el detalle de un match, a pantalla completa y fuera de las pestañas. */
export function MatchDetailRoute() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  return <MatchDetailScreen matchId={matchId} />;
}
