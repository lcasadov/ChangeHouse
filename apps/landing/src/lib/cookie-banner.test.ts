import { beforeEach, describe, expect, it, vi } from 'vitest';

import Home from '../pages/index.astro';
import { renderDocument } from '../tests/render';
import { type ConsentStatus, type ConsentStorage, createConsent } from './consent';
import { initCookieBanner } from './cookie-banner';

function setup(initial?: ConsentStatus) {
  const data = new Map<string, string>(
    initial && initial !== 'undecided' ? [['changehouse.consent', initial]] : [],
  );
  const storage: ConsentStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
  const consent = createConsent(storage);
  return { consent, data };
}

describe('Controlador del aviso de cookies', () => {
  let doc: Document;

  const banner = () => doc.querySelector<HTMLElement>('#cookie-banner')!;
  const panel = () => doc.querySelector<HTMLElement>('#cookie-settings')!;
  const analytics = () => doc.querySelector<HTMLInputElement>('#cookie-analytics')!;
  const status = () => doc.querySelector('#cookie-status')!.textContent.trim();
  const click = (selector: string) => {
    const element = doc.querySelector(selector);
    if (!element) throw new Error(`No existe ${selector}`);
    element.dispatchEvent(
      new (doc.defaultView as unknown as { Event: typeof Event }).Event('click', { bubbles: true }),
    );
  };
  const isHidden = (element: Element) => element.hasAttribute('hidden');

  beforeEach(async () => {
    doc = await renderDocument(Home);
  });

  it('Scenario: Sin cookies no esenciales antes de decidir - sin decisión se muestra el aviso y no se guarda nada', () => {
    const { consent, data } = setup();

    initCookieBanner(doc, consent);

    expect(isHidden(banner())).toBe(false);
    expect(data.size).toBe(0);
  });

  it('Scenario: La elección se recuerda - con una decisión guardada no se vuelve a preguntar', () => {
    const { consent } = setup('rejected');

    initCookieBanner(doc, consent);

    expect(isHidden(banner())).toBe(true);
  });

  it('Scenario: Rechazar es tan fácil como aceptar - rechazar es un solo clic y cierra el aviso', () => {
    const { consent } = setup();
    initCookieBanner(doc, consent);

    click('[data-consent="reject"]');

    expect(consent.getConsent()).toBe('rejected');
    expect(isHidden(banner())).toBe(true);
    expect(status()).toContain('guardado');
  });

  it('aceptar es un solo clic y cierra el aviso', () => {
    const { consent } = setup();
    initCookieBanner(doc, consent);

    click('[data-consent="accept"]');

    expect(consent.getConsent()).toBe('accepted');
    expect(isHidden(banner())).toBe(true);
  });

  it('«Configurar» abre y cierra el panel e indica su estado a los lectores de pantalla', () => {
    const { consent } = setup();
    initCookieBanner(doc, consent);
    const toggle = doc.querySelector('[data-consent="configure"]')!;

    click('[data-consent="configure"]');
    expect(isHidden(panel())).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    click('[data-consent="configure"]');
    expect(isHidden(panel())).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('desde el panel se puede aceptar la analítica o dejarla desactivada', () => {
    const { consent } = setup();
    initCookieBanner(doc, consent);
    click('[data-consent="configure"]');
    expect(analytics().checked).toBe(false);

    analytics().checked = true;
    click('[data-consent="save"]');
    expect(consent.getConsent()).toBe('accepted');
    expect(isHidden(banner())).toBe(true);
  });

  it('guardar con la analítica desactivada equivale a rechazar', () => {
    const { consent } = setup();
    initCookieBanner(doc, consent);
    click('[data-consent="configure"]');

    click('[data-consent="save"]');

    expect(consent.getConsent()).toBe('rejected');
  });

  it('Scenario: Cambiar la elección - el enlace del pie reabre el aviso con la elección actual', () => {
    const { consent } = setup('accepted');
    initCookieBanner(doc, consent);

    click('[data-cookie-settings]');

    expect(isHidden(banner())).toBe(false);
    expect(isHidden(panel())).toBe(false);
    expect(analytics().checked).toBe(true);
  });

  it('Scenario: Cambiar la elección - la nueva elección se aplica de inmediato y el foco vuelve al pie', () => {
    const { consent } = setup('accepted');
    const listener = vi.fn();
    consent.onConsentChange(listener);
    initCookieBanner(doc, consent);
    const trigger = doc.querySelector<HTMLElement>('[data-cookie-settings]')!;
    const focus = vi.spyOn(trigger, 'focus');

    click('[data-cookie-settings]');
    click('[data-consent="reject"]');

    expect(listener).toHaveBeenCalledExactlyOnceWith('rejected');
    expect(isHidden(banner())).toBe(true);
    expect(focus).toHaveBeenCalled();
  });

  it('al reabrir desde el pie lleva el foco al aviso', () => {
    const { consent } = setup('rejected');
    initCookieBanner(doc, consent);
    const title = doc.querySelector<HTMLElement>('#cookie-banner-title')!;
    const focus = vi.spyOn(title, 'focus');

    click('[data-cookie-settings]');

    expect(focus).toHaveBeenCalled();
  });

  it('al desmontarlo deja de reaccionar', () => {
    const { consent } = setup();
    const dispose = initCookieBanner(doc, consent);

    dispose();
    click('[data-consent="accept"]');

    expect(consent.getConsent()).toBe('undecided');
  });
});
