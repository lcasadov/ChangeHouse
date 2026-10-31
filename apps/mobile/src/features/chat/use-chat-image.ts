import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthProvider';
import { useServices } from '../session/services';
import type { ChatImageUrl } from './chat-api';
import { imageUrlFreshForMs } from './chat-model';

const FIFTEEN_MINUTES_MS = 15 * 60_000;

/**
 * La URL firmada de una imagen del chat (los mensajes solo llevan un `imageId` opaco). Se guarda en
 * la caché de consultas hasta poco antes de que caduque, así que una imagen que sale y vuelve a
 * entrar en pantalla no se vuelve a pedir mientras la URL vale.
 */
export function useChatImage(matchId: string, imageId: string | undefined) {
  const { chatApi } = useServices();
  const { status, user } = useAuth();
  return useQuery<ChatImageUrl>({
    queryKey: ['chat-image', user?.uid, matchId, imageId],
    queryFn: () => chatApi.getImageUrl(matchId, imageId ?? ''),
    enabled: status === 'signedIn' && imageId !== undefined,
    retry: false,
    staleTime: (query) => (query.state.data ? imageUrlFreshForMs(query.state.data.expiresAt) : 0),
    gcTime: FIFTEEN_MINUTES_MS,
  });
}
