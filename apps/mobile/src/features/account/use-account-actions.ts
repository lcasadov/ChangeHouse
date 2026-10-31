import { useCallback, useRef, useState } from 'react';

import { useSignOut } from '../auth/use-sign-out';
import { useServices } from '../session/services';
import { AccountApiError } from './account-api';
import { DATA_EXPORT_FILENAME } from './data-exporter';

export type ActionFailure = 'network' | 'unknown' | 'delivery';

class DeliveryError extends Error {}

function failureOf(error: unknown): ActionFailure {
  return error instanceof AccountApiError && error.kind === 'network' ? 'network' : 'unknown';
}

function exportFailureOf(error: unknown): ActionFailure {
  return error instanceof DeliveryError ? 'delivery' : failureOf(error);
}

export interface ActionState {
  /** La acción está en curso: no se admite otra petición. */
  busy: boolean;
  /** La última ejecución terminó bien. */
  done: boolean;
  failure: ActionFailure | null;
}

/** Evita una segunda petición mientras la primera sigue en curso, aunque la pantalla aún no lo refleje. */
function useGuardedAction(run: () => Promise<void>, onFailure: (error: unknown) => ActionFailure) {
  const running = useRef(false);
  const [state, setState] = useState<ActionState>({ busy: false, done: false, failure: null });
  const start = useCallback(async () => {
    if (running.current) return false;
    running.current = true;
    setState({ busy: true, done: false, failure: null });
    try {
      await run();
      setState({ busy: false, done: true, failure: null });
      return true;
    } catch (error) {
      setState({ busy: false, done: false, failure: onFailure(error) });
      return false;
    } finally {
      running.current = false;
    }
  }, [run, onFailure]);
  const reset = useCallback(() => {
    setState({ busy: false, done: false, failure: null });
  }, []);
  return { state, start, reset };
}

/** «Eliminar mi cuenta»: `deleteMe` y, al terminar, cierre de sesión. */
export function useDeleteAccount() {
  const { accountApi } = useServices();
  const signOut = useSignOut();
  const run = useCallback(async () => {
    await accountApi.deleteMe();
    // La cuenta ya no existe: aunque el cierre local falle, la sesión no sirve de nada
    await signOut().catch(() => undefined);
  }, [accountApi, signOut]);
  return useGuardedAction(run, failureOf);
}

/** «Descargar mis datos»: pide la exportación y la entrega para guardar o compartir. */
export function useExportData() {
  const { accountApi, dataExporter } = useServices();
  const run = useCallback(async () => {
    const data = await accountApi.exportMyData();
    try {
      await dataExporter.deliver({
        filename: DATA_EXPORT_FILENAME,
        content: JSON.stringify(data, null, 2),
      });
    } catch {
      throw new DeliveryError();
    }
  }, [accountApi, dataExporter]);
  return useGuardedAction(run, exportFailureOf);
}
