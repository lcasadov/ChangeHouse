import { useLocalSearchParams } from 'expo-router';

import { ChatScreen } from './ChatScreen';

/** `/match/{matchId}/chat`: el chat de un match, a pantalla completa y fuera de las pestañas. */
export function ChatRoute() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  return <ChatScreen matchId={matchId} />;
}
