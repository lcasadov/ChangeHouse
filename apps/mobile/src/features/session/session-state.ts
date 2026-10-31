import type { Me } from '../account/account-api';
import type { AuthStatus } from '../auth/AuthProvider';

/**
 * Dónde está la persona respecto al acceso:
 * - `loading`: restaurando la sesión o consultando su cuenta.
 * - `signedOut`: sin sesión, va a la bienvenida.
 * - `unregistered`: autenticada pero sin alta en ChangeHouse, va al alta.
 * - `ready`: dada de alta, ve las pestañas.
 * - `suspended`: un admin ha suspendido su cuenta; solo ve la pantalla de cuenta suspendida.
 * - `error`: no se ha podido consultar la cuenta; se puede reintentar.
 */
export type SessionState =
  'loading' | 'signedOut' | 'unregistered' | 'ready' | 'suspended' | 'error';

export interface MeQuery {
  status: 'pending' | 'error' | 'success';
  /** `null` = la API respondió que aún no hay alta. */
  data: Me | null | undefined;
}

export function deriveSessionState(auth: AuthStatus, me: MeQuery): SessionState {
  if (auth === 'loading') return 'loading';
  if (auth === 'signedOut') return 'signedOut';
  if (me.status === 'pending') return 'loading';
  if (me.status === 'error') return 'error';
  if (!me.data) return 'unregistered';
  return me.data.suspended ? 'suspended' : 'ready';
}
