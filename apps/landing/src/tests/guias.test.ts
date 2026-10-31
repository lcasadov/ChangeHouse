import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import GuideList from '../components/GuideList.astro';
import { es } from '../i18n/es';
import GuideLayout from '../layouts/GuideLayout.astro';
import type { GuideEntry } from '../lib/guias';
import { renderDocument } from './render';

const guide = (id: string, date: string, draft = false): GuideEntry => ({
  id,
  data: {
    title: `Guía ${id}`,
    description: `Resumen de la guía ${id}`,
    date: new Date(date),
    image: '/og.png',
    draft,
  },
});

const listed = [
  guide('reciente', '2026-03-20'),
  guide('media', '2026-02-15'),
  guide('antigua', '2026-01-10'),
];

describe('Listado de guías', () => {
  it('Scenario: Listado de guías - muestra las tres con título, fecha y resumen, la más reciente primero', async () => {
    const doc = await renderDocument(GuideList, { guides: listed }, '/guias');

    const items = [...doc.querySelectorAll('li')];
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.querySelector('h2')?.textContent.trim())).toEqual([
      'Guía reciente',
      'Guía media',
      'Guía antigua',
    ]);
    expect(items[0]?.textContent).toContain('Resumen de la guía reciente');
    expect(items[0]?.querySelector('time')?.getAttribute('datetime')).toBe('2026-03-20');
    expect(items[0]?.querySelector('time')?.textContent).toBe('20 de marzo de 2026');
    expect(items[0]?.querySelector('a')?.getAttribute('href')).toBe('/guias/reciente');
  });

  it('indica que aún no hay guías cuando la lista está vacía', async () => {
    const doc = await renderDocument(GuideList, { guides: [] }, '/guias');

    expect(doc.querySelectorAll('li')).toHaveLength(0);
    expect(doc.querySelector('[role="status"]')?.textContent).toContain(es.guides.empty);
  });

  it('marca como borrador las guías sin publicar', async () => {
    const doc = await renderDocument(
      GuideList,
      { guides: [guide('reciente', '2026-03-20', true)] },
      '/guias',
    );

    expect(doc.querySelector('li')?.textContent).toContain(es.guides.draftBadge);
  });
});

describe('Artículo', () => {
  const props = {
    guide: guide('que-es-una-permuta', '2026-03-01'),
    toc: [
      { slug: 'primera', text: 'Primera sección' },
      { slug: 'segunda', text: 'Segunda sección' },
    ],
    minutes: 4,
  };
  const render = () =>
    renderDocument(GuideLayout, props, '/guias/que-es-una-permuta', {
      default: '<h2 id="primera">Primera sección</h2><p>Texto</p>',
    });

  it('Scenario: Artículo - muestra título, fecha, tiempo de lectura e índice de secciones', async () => {
    const doc = await render();

    expect(doc.querySelector('h1')?.textContent).toBe('Guía que-es-una-permuta');
    expect(doc.querySelector('time')?.getAttribute('datetime')).toBe('2026-03-01');
    expect(doc.body.textContent).toContain('4 min de lectura');
    const toc = doc.querySelector('nav[aria-label="Índice de secciones"]');
    expect([...(toc?.querySelectorAll('a') ?? [])].map((a) => a.getAttribute('href'))).toEqual([
      '#primera',
      '#segunda',
    ]);
  });

  it('Scenario: Artículo - termina con el acceso a la lista de espera', async () => {
    const doc = await render();

    const cta = doc.querySelector('.guide-cta a');
    expect(cta?.getAttribute('href')).toBe('/#lista-de-espera');
    expect(cta?.textContent.trim()).toBe(es.guides.cta.button);
    const article = doc.querySelector('article');
    expect(article?.lastElementChild?.classList.contains('guide-cta')).toBe(true);
  });

  it('no pinta el índice si el artículo no tiene secciones', async () => {
    const doc = await renderDocument(GuideLayout, { ...props, toc: [] }, '/guias/x');

    expect(doc.querySelector('nav[aria-label="Índice de secciones"]')).toBeNull();
  });

  it('Scenario: Datos estructurados - el head contiene el JSON-LD de tipo Article', async () => {
    const doc = await render();

    const script = doc.querySelector('head script[type="application/ld+json"]');
    const data = JSON.parse(script?.textContent ?? '{}') as Record<string, unknown>;
    expect(data).toMatchObject({
      '@type': 'Article',
      headline: 'Guía que-es-una-permuta',
      datePublished: '2026-03-01T00:00:00.000Z',
      image: ['https://changehouse.app/og.png'],
      mainEntityOfPage: 'https://changehouse.app/guias/que-es-una-permuta',
    });
  });

  it('declara metadatos propios del artículo', async () => {
    const doc = await render();

    expect(doc.title).toBe('Guía que-es-una-permuta · ChangeHouse');
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Resumen de la guía que-es-una-permuta',
    );
    expect(doc.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('article');
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://changehouse.app/guias/que-es-una-permuta',
    );
  });
});

describe('Contenido de las guías', () => {
  const ownDirectory = join(import.meta.dirname, '../content/guias');
  const directories = [ownDirectory, join(import.meta.dirname, '../../e2e/guias-content')];
  const markdownIn = (directory: string) =>
    readdirSync(directory).filter((name) => name.endsWith('.md'));
  const files = directories.flatMap((directory) =>
    markdownIn(directory).map((name) => ({
      name,
      text: readFileSync(join(directory, name), 'utf8'),
    })),
  );

  it('incluye las tres guías iniciales, todas en borrador', () => {
    const own = markdownIn(ownDirectory).sort();

    expect(own).toEqual(['cadenas-de-tres.md', 'nociones-fiscales.md', 'que-es-una-permuta.md']);
    for (const name of own) {
      expect(readFileSync(join(ownDirectory, name), 'utf8'), name).toMatch(/^draft: true$/m);
    }
  });

  it('Scenario: Guías publicadas - ningún artículo habla de «ahorro fiscal» (RN-07)', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
    expect(files.filter((file) => /ahorro\s+fiscal/i.test(file.text)).map((f) => f.name)).toEqual(
      [],
    );
  });

  it('Scenario: Guías publicadas - ningún artículo recomienda valores de escritura (RN-07)', () => {
    const offending = files.filter((file) =>
      /(escritur\w+|valor\s+declarado).{0,40}(por debajo|menos|inferior|menor|reducid)/i.test(
        file.text,
      ),
    );

    expect(offending.map((file) => file.name)).toEqual([]);
  });
});
