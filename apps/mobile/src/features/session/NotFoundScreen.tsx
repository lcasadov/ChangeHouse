import { type Href, Redirect } from 'expo-router';

import { LoadingView } from './LoadingView';
import type { SessionState } from './session-state';
import { useSession } from './use-session';

const HOME: Record<SessionState, Href | null> = {
  signedOut: '/welcome',
  unregistered: '/onboarding',
  ready: '/',
  suspended: '/suspended',
  loading: null,
  error: null,
};

/**
 * Una ruta que no existe para la sesión actual (una pestaña sin sesión, la bienvenida con sesión, una
 * dirección desconocida) lleva a la pantalla de inicio que le toca a la persona.
 */
export function NotFoundScreen() {
  const { state } = useSession();
  const home = HOME[state];
  return home ? <Redirect href={home} /> : <LoadingView />;
}
