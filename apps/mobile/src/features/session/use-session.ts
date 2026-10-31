import { useEffect } from 'react';

import { AccountApiError } from '../account/account-api';
import { useMe } from '../account/use-me';
import { useAuth } from '../auth/AuthProvider';
import { useSignOut } from '../auth/use-sign-out';
import { useServices } from './services';
import { deriveSessionState, type SessionState } from './session-state';

/** Estado de acceso de la persona y la forma de reintentar si no se pudo consultar su cuenta. */
export function useSession(): { state: SessionState; retry: () => void } {
  const { status } = useAuth();
  const signOut = useSignOut();
  const me = useMe();
  const { accountSuspension } = useServices();
  const { refetch } = me;

  // Una petición respondió 403 ACCOUNT_SUSPENDED: la cuenta dirá si está suspendida (fuente de verdad)
  useEffect(
    () =>
      accountSuspension.subscribe(() => {
        refetch().catch(() => undefined);
      }),
    [accountSuspension, refetch],
  );

  // La API no acepta el token (cuenta deshabilitada o sesión revocada): la sesión local ya no vale
  const rejected = me.error instanceof AccountApiError && me.error.kind === 'unauthorized';
  useEffect(() => {
    if (rejected) signOut().catch(() => undefined);
  }, [rejected, signOut]);

  const query = rejected
    ? ({ status: 'pending', data: undefined } as const)
    : { status: me.status, data: me.data };

  return {
    state: deriveSessionState(status, query),
    retry: () => {
      me.refetch().catch(() => undefined);
    },
  };
}
