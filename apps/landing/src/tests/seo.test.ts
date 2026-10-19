import { describe, expect, it } from 'vitest';

import Seo from '../components/Seo.astro';
import LegalNotice from '../pages/aviso-legal.astro';
import Cookies from '../pages/cookies.astro';
import Home from '../pages/index.astro';
import Privacy from '../pages/privacidad.astro';
import Terms from '../pages/terminos.astro';
import { renderDocument } from './render';

const pages = [
  { path: '/', component: Home },
  { path: '/aviso-legal', component: LegalNotice },
  { path: '/privacidad', component: Privacy },
  { path: '/cookies', component: Cookies },
  { path: '/terminos', component: Terms },
];

const meta = (doc: Document, selector: string) =>
  doc.querySelector(selector)?.getAttribute('content') ?? '';

const heads = await Promise.all(
  pages.map(async ({ path, component }) => ({
    path,
    doc: await renderDocument(component, {}, path),
  })),
);

describe('Metadatos por página', () => {
  it.each(heads)(
    'Scenario: Metadatos por página - $path declara título, descripción e imagen',
    ({ doc }) => {
      expect(doc.title.length).toBeGreaterThan(5);
      expect(meta(doc, 'meta[name="description"]').length).toBeGreaterThan(40);
      expect(meta(doc, 'meta[property="og:title"]')).toBe(doc.title);
      expect(meta(doc, 'meta[property="og:description"]')).toBe(
        meta(doc, 'meta[name="description"]'),
      );
      expect(meta(doc, 'meta[property="og:image"]')).toBe('https://changehouse.app/og.png');
      expect(meta(doc, 'meta[property="og:image:alt"]').length).toBeGreaterThan(5);
      expect(meta(doc, 'meta[name="twitter:card"]')).toBe('summary_large_image');
      expect(meta(doc, 'meta[property="og:locale"]')).toBe('es_ES');
    },
  );

  it.each(heads)('$path declara su URL canónica', ({ path, doc }) => {
    const expected = `https://changehouse.app${path}`;
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(expected);
    expect(meta(doc, 'meta[property="og:url"]')).toBe(expected);
  });

  it('Scenario: Metadatos por página - títulos y descripciones son propios de cada página', () => {
    const titles = heads.map(({ doc }) => doc.title);
    const descriptions = heads.map(({ doc }) => meta(doc, 'meta[name="description"]'));

    expect(new Set(titles).size).toBe(pages.length);
    expect(new Set(descriptions).size).toBe(pages.length);
  });
});

describe('Seo', () => {
  it('acepta una imagen propia y la convierte en URL absoluta', async () => {
    const doc = await renderDocument(
      Seo,
      { title: 'Prueba', description: 'Descripción de prueba', image: '/otra.png' },
      '/prueba',
    );

    expect(meta(doc, 'meta[property="og:image"]')).toBe('https://changehouse.app/otra.png');
  });
});
