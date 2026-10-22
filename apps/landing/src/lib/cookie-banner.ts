import { es } from '../i18n/es';
import type { Consent } from './consent';

const HEIGHT_VARIABLE = '--cookie-banner-height';

/** Reserva en la página el espacio que ocupa el aviso para que no tape contenido ni foco. */
function trackHeight(doc: Document, banner: HTMLElement): () => void {
  const view = doc.defaultView;
  if (!view || typeof view.ResizeObserver === 'undefined') return () => undefined;

  const root = doc.documentElement;
  const observer = new view.ResizeObserver(() => {
    const height = banner.hidden ? 0 : banner.offsetHeight;
    root.style.setProperty(HEIGHT_VARIABLE, `${height}px`);
  });
  observer.observe(banner);
  return () => {
    observer.disconnect();
    root.style.removeProperty(HEIGHT_VARIABLE);
  };
}

/**
 * Conecta el aviso de cookies con el módulo de consentimiento: lo muestra solo si no hay
 * decisión, resuelve aceptar, rechazar y configurar con un solo paso, y permite reabrirlo
 * desde el pie. Devuelve la función que deshace todo.
 */
export function initCookieBanner(doc: Document, consent: Consent): () => void {
  const banner = doc.querySelector<HTMLElement>('#cookie-banner');
  const panel = doc.querySelector<HTMLElement>('#cookie-settings');
  const toggle = doc.querySelector<HTMLElement>('[data-consent="configure"]');
  const analytics = doc.querySelector<HTMLInputElement>('#cookie-analytics');
  const title = doc.querySelector<HTMLElement>('#cookie-banner-title');
  const status = doc.querySelector<HTMLElement>('#cookie-status');
  if (!banner || !panel || !toggle || !analytics) return () => undefined;

  let opener: HTMLElement | null = null;

  const setPanel = (open: boolean) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };

  const show = (withSettings: boolean) => {
    analytics.checked = consent.getConsent() === 'accepted';
    setPanel(withSettings);
    banner.hidden = false;
  };

  const decide = (decision: 'accepted' | 'rejected') => {
    consent.setConsent(decision);
    banner.hidden = true;
    setPanel(false);
    if (status) status.textContent = es.cookies.banner.saved;
    opener?.focus();
    opener = null;
  };

  const actions: Record<string, () => void> = {
    accept: () => decide('accepted'),
    reject: () => decide('rejected'),
    configure: () => setPanel(panel.hidden),
    save: () => decide(analytics.checked ? 'accepted' : 'rejected'),
  };

  const onClick = (event: Event) => {
    const target = event.target as Element | null;

    const settings = target?.closest<HTMLElement>('[data-cookie-settings]');
    if (settings) {
      opener = settings;
      show(true);
      title?.focus();
      return;
    }

    const action = target?.closest<HTMLElement>('[data-consent]')?.dataset.consent;
    if (action) actions[action]?.();
  };

  if (consent.getConsent() === 'undecided') show(false);
  doc.addEventListener('click', onClick);
  const stopTracking = trackHeight(doc, banner);

  return () => {
    doc.removeEventListener('click', onClick);
    stopTracking();
  };
}
