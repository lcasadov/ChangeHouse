/**
 * Aviso de «la API dice que la cuenta está suspendida» (403 `ACCOUNT_SUSPENDED`). Lo emite el
 * cliente HTTP desde cualquier petición y lo escucha la sesión, que vuelve a consultar la cuenta.
 */
export interface AccountSuspensionSignal {
  notify: () => void;
  /** Devuelve la baja de la suscripción. */
  subscribe: (listener: () => void) => () => void;
}

export function createAccountSuspensionSignal(): AccountSuspensionSignal {
  const listeners = new Set<() => void>();
  return {
    notify: () => {
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
