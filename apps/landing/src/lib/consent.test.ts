import { afterEach, describe, expect, it, vi } from 'vitest';

import { ANALYTICS_ALLOWED, ANALYTICS_REVOKED, bindAnalytics } from './analytics';
import { browserConsent, CONSENT_STORAGE_KEY, type ConsentStorage, createConsent } from './consent';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: ConsentStorage = {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void data.set(key, value)),
  };
  return { storage, data };
}

describe('Consentimiento de cookies', () => {
  it('Scenario: Sin cookies no esenciales antes de decidir - sin decisión no hay datos guardados', () => {
    const { storage, data } = memoryStorage();
    const consent = createConsent(storage);

    expect(consent.getConsent()).toBe('undecided');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(data.size).toBe(0);
  });

  it('Scenario: Sin cookies no esenciales antes de decidir - solo se guarda la propia decisión', () => {
    const { storage, data } = memoryStorage();
    createConsent(storage).setConsent('accepted');

    expect([...data.keys()]).toEqual([CONSENT_STORAGE_KEY]);
  });

  it('aceptar guarda la decisión y la devuelve', () => {
    const { storage } = memoryStorage();
    const consent = createConsent(storage);

    consent.setConsent('accepted');

    expect(consent.getConsent()).toBe('accepted');
  });

  it('Scenario: La elección se recuerda - tras recargar el rechazo persiste', () => {
    const { storage } = memoryStorage();
    createConsent(storage).setConsent('rejected');

    const afterReload = createConsent(storage);

    expect(afterReload.getConsent()).toBe('rejected');
  });

  it('Scenario: Cambiar la elección - se puede pasar de rechazado a aceptado y al revés', () => {
    const { storage } = memoryStorage();
    const consent = createConsent(storage);

    consent.setConsent('rejected');
    consent.setConsent('accepted');
    expect(consent.getConsent()).toBe('accepted');

    consent.setConsent('rejected');
    expect(consent.getConsent()).toBe('rejected');
  });

  it('Scenario: Cambiar la elección - notifica el cambio de inmediato y deja de hacerlo al darse de baja', () => {
    const { storage } = memoryStorage();
    const consent = createConsent(storage);
    const listener = vi.fn();

    const unsubscribe = consent.onConsentChange(listener);
    consent.setConsent('accepted');
    expect(listener).toHaveBeenCalledExactlyOnceWith('accepted');

    unsubscribe();
    consent.setConsent('rejected');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('no notifica si la decisión no cambia', () => {
    const { storage } = memoryStorage();
    const consent = createConsent(storage);
    const listener = vi.fn();
    consent.onConsentChange(listener);

    consent.setConsent('rejected');
    consent.setConsent('rejected');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('trata como «sin decidir» un valor guardado desconocido o corrupto', () => {
    const { storage } = memoryStorage({ [CONSENT_STORAGE_KEY]: 'tal-vez' });

    expect(createConsent(storage).getConsent()).toBe('undecided');
  });

  it('sigue funcionando en memoria si el almacenamiento falla (modo privado)', () => {
    const failing: ConsentStorage = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    const consent = createConsent(failing);

    expect(consent.getConsent()).toBe('undecided');
    consent.setConsent('accepted');
    expect(consent.getConsent()).toBe('accepted');
  });

  it('sin almacenamiento disponible la decisión solo vive en memoria', () => {
    const consent = createConsent(null);

    expect(consent.getConsent()).toBe('undecided');
    consent.setConsent('rejected');
    expect(consent.getConsent()).toBe('rejected');
  });
});

describe('browserConsent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('usa localStorage del navegador cuando existe', () => {
    const { storage, data } = memoryStorage();
    vi.stubGlobal('localStorage', storage);

    browserConsent().setConsent('rejected');

    expect(data.get(CONSENT_STORAGE_KEY)).toBe('rejected');
  });

  it('sobrevive a un localStorage que lanza al accederse', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });

    try {
      expect(browserConsent().getConsent()).toBe('undecided');
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});

describe('Enganche de analítica', () => {
  function setup(initial?: 'accepted' | 'rejected') {
    const { storage } = memoryStorage(initial ? { [CONSENT_STORAGE_KEY]: initial } : {});
    const consent = createConsent(storage);
    const target = new EventTarget();
    const allowed = vi.fn();
    const revoked = vi.fn();
    target.addEventListener(ANALYTICS_ALLOWED, allowed);
    target.addEventListener(ANALYTICS_REVOKED, revoked);
    return { consent, target, allowed, revoked };
  }

  it('Scenario: Sin cookies no esenciales antes de decidir - no se avisa a ninguna analítica', () => {
    const { consent, target, allowed, revoked } = setup();

    bindAnalytics(consent, target);

    expect(allowed).not.toHaveBeenCalled();
    expect(revoked).not.toHaveBeenCalled();
  });

  it('Scenario: La elección se recuerda - con rechazo guardado la analítica sigue sin cargarse', () => {
    const { consent, target, allowed } = setup('rejected');

    bindAnalytics(consent, target);

    expect(allowed).not.toHaveBeenCalled();
  });

  it('con aceptación guardada avisa de inmediato', () => {
    const { consent, target, allowed } = setup('accepted');

    bindAnalytics(consent, target);

    expect(allowed).toHaveBeenCalledTimes(1);
  });

  it('Scenario: Cambiar la elección - aceptar la activa y revocar la desactiva al momento', () => {
    const { consent, target, allowed, revoked } = setup();
    bindAnalytics(consent, target);

    consent.setConsent('accepted');
    expect(allowed).toHaveBeenCalledTimes(1);

    consent.setConsent('rejected');
    expect(revoked).toHaveBeenCalledTimes(1);
  });

  it('rechazar sin haber aceptado antes no emite revocación', () => {
    const { consent, target, revoked } = setup();
    bindAnalytics(consent, target);

    consent.setConsent('rejected');

    expect(revoked).not.toHaveBeenCalled();
  });

  it('darse de baja detiene los avisos', () => {
    const { consent, target, allowed } = setup();
    const unbind = bindAnalytics(consent, target);

    unbind();
    consent.setConsent('accepted');

    expect(allowed).not.toHaveBeenCalled();
  });
});
