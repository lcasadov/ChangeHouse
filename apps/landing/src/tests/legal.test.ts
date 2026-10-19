import { describe, expect, it } from 'vitest';

import LegalNotice from '../pages/aviso-legal.astro';
import Cookies from '../pages/cookies.astro';
import Home from '../pages/index.astro';
import Privacy from '../pages/privacidad.astro';
import Terms from '../pages/terminos.astro';
import { renderDocument } from './render';

const legalPages = [
  { path: '/aviso-legal', component: LegalNotice, name: /aviso legal/i },
  { path: '/privacidad', component: Privacy, name: /privacidad/i },
  { path: '/cookies', component: Cookies, name: /cookies/i },
  { path: '/terminos', component: Terms, name: /t[eé]rminos/i },
];

const allPages = [{ path: '/', component: Home, name: /ChangeHouse/ }, ...legalPages];

describe('Páginas legales', () => {
  describe.each(allPages)('página $path', ({ path, component }) => {
    it('Scenario: Enlaces legales en el pie — enlaza las cuatro páginas legales', async () => {
      const doc = await renderDocument(component, {}, path);
      const footer = doc.querySelector('footer');
      for (const { path: href, name } of legalPages) {
        const link = footer?.querySelector(`a[href="${href}"]`);
        expect(link, `${path} → ${href}`).not.toBeNull();
        expect(link?.textContent).toMatch(name);
      }
    });

    it('Scenario: Cambiar la elección — el pie ofrece «Configurar cookies»', async () => {
      const doc = await renderDocument(component, {}, path);
      const button = doc.querySelector('footer button[data-cookie-settings]');
      expect(button?.textContent.trim()).toBe('Configurar cookies');
    });
  });

  describe.each(legalPages)('página legal $path', ({ path, component }) => {
    it('Scenario: Texto pendiente de revisión identificado — muestra el aviso de borrador', async () => {
      const doc = await renderDocument(component, {}, path);
      const notice = doc.querySelector('main [role="note"]');
      expect(notice?.textContent).toContain('Borrador pendiente de revisión jurídica');
    });

    it('tiene un único h1, secciones tituladas y no inventa datos de empresa', async () => {
      const doc = await renderDocument(component, {}, path);
      expect(doc.querySelectorAll('h1')).toHaveLength(1);
      expect(doc.querySelectorAll('main h2').length).toBeGreaterThanOrEqual(3);
      expect(doc.querySelector('main')?.textContent).toContain('[Razón social]');
    });

    it('permite volver a la página principal', async () => {
      const doc = await renderDocument(component, {}, path);
      expect(doc.querySelector('header a[href="/"]')).not.toBeNull();
    });
  });

  it('la página principal no lleva el aviso de borrador legal', async () => {
    const doc = await renderDocument(Home);
    expect(doc.body.textContent).not.toContain('Borrador pendiente de revisión jurídica');
  });
});
