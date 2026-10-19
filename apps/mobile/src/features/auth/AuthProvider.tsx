import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { useServices } from '../session/services';
import type { AuthUser } from './auth-service';

/** `loading` hasta que el dispositivo termina de restaurar la sesión recordada. */
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
}

const LOADING: AuthState = { status: 'loading', user: null };
const AuthContext = createContext<AuthState | null>(null);

/** Mantiene la sesión de la persona a partir del puerto `AuthService`. */
export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { auth } = useServices();
  const [state, setState] = useState<AuthState>(LOADING);

  useEffect(
    () =>
      auth.subscribe((user) => {
        setState(user ? { status: 'signedIn', user } : { status: 'signedOut', user: null });
      }),
    [auth],
  );

  const value = useMemo(() => state, [state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return state;
}
