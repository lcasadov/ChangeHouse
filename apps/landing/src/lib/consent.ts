export type ConsentStatus = 'undecided' | 'accepted' | 'rejected';
export type ConsentDecision = Exclude<ConsentStatus, 'undecided'>;

/** Subconjunto de `Storage` que necesita el módulo; permite probarlo sin navegador. */
export type ConsentStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface Consent {
  getConsent: () => ConsentStatus;
  setConsent: (decision: ConsentDecision) => void;
  /** Avisa cuando la decisión cambia. Devuelve la función para darse de baja. */
  onConsentChange: (listener: (status: ConsentStatus) => void) => () => void;
}

export const CONSENT_STORAGE_KEY = 'changehouse.consent';

const isDecision = (value: unknown): value is ConsentDecision =>
  value === 'accepted' || value === 'rejected';

function readStored(storage: ConsentStorage | null): ConsentStatus {
  try {
    const stored = storage?.getItem(CONSENT_STORAGE_KEY);
    return isDecision(stored) ? stored : 'undecided';
  } catch {
    return 'undecided';
  }
}

/**
 * Módulo de consentimiento. Guardar la propia decisión es esencial; nada más se escribe
 * jamás en el almacenamiento, y nada se escribe antes de que la persona decida. Si el
 * almacenamiento no está disponible, la decisión vive solo en memoria durante la visita.
 */
export function createConsent(storage: ConsentStorage | null): Consent {
  const listeners = new Set<(status: ConsentStatus) => void>();
  let current = readStored(storage);

  return {
    getConsent: () => current,
    setConsent(decision) {
      if (decision === current) return;
      current = decision;
      try {
        storage?.setItem(CONSENT_STORAGE_KEY, decision);
      } catch {
        // Almacenamiento bloqueado (modo privado): la decisión se mantiene en memoria
      }
      listeners.forEach((listener) => listener(decision));
    },
    onConsentChange(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

function browserStorage(): ConsentStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Consentimiento respaldado por el `localStorage` del navegador. */
export const browserConsent = (): Consent => createConsent(browserStorage());
