import { describe, expect, it } from 'vitest';

import CookieBanner from '../components/CookieBanner.astro';
import { es } from '../i18n/es';
import { renderDocument } from './render';

const doc = await renderDocument(CookieBanner);
const banner = doc.querySelector('#cookie-banner');
const button = (action: string) => banner?.querySelector(`button[data-consent="${action}"]`);

describe('Aviso de cookies', () => {
  it('Scenario: Sin cookies no esenciales antes de decidir - nace oculto y es accesible', () => {
    expect(banner?.hasAttribute('hidden')).toBe(true);
    expect(banner?.getAttribute('role')).toBe('region');
    expect(banner?.getAttribute('aria-labelledby')).toBeTruthy();
  });

  it('Scenario: Rechazar es tan fácil como aceptar - «Aceptar» y «Rechazar» tienen la misma jerarquía', () => {
    const accept = button('accept');
    const reject = button('reject');

    expect(accept?.textContent.trim()).toBe(es.cookies.banner.accept);
    expect(reject?.textContent.trim()).toBe(es.cookies.banner.reject);
    expect(accept?.getAttribute('class')).toBe(reject?.getAttribute('class'));
    expect(accept?.parentElement).toBe(reject?.parentElement);
  });

  it('Scenario: Rechazar es tan fácil como aceptar - «Configurar» está al mismo nivel y sin pasos previos', () => {
    const configure = button('configure');

    expect(configure?.textContent.trim()).toBe(es.cookies.banner.configure);
    expect(configure?.getAttribute('class')).toBe(button('accept')?.getAttribute('class'));
    expect(configure?.parentElement).toBe(button('accept')?.parentElement);
    expect(configure?.getAttribute('aria-expanded')).toBe('false');
  });

  it('el panel de configuración nace cerrado y ofrece la analítica desactivada por defecto', () => {
    const panel = banner?.querySelector('#cookie-settings');
    const analytics = panel?.querySelector('input[type="checkbox"][name="analytics"]');

    expect(panel?.hasAttribute('hidden')).toBe(true);
    expect(analytics).not.toBeNull();
    expect(analytics?.hasAttribute('checked')).toBe(false);
    expect(panel?.querySelector('label[for="cookie-analytics"]')).not.toBeNull();
    expect(panel?.querySelector('button[data-consent="save"]')).not.toBeNull();
  });

  it('enlaza la política de cookies', () => {
    expect(banner?.querySelector('a[href="/cookies"]')).not.toBeNull();
  });
});
