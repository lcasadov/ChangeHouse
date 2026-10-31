import { describe, expect, it } from 'vitest';

import {
  articleJsonLd,
  formatGuideDate,
  type GuideEntry,
  guidePath,
  publishedGuides,
  readingMinutes,
  rssItems,
  serializeJsonLd,
  tableOfContents,
} from './guias';

const guide = (id: string, date: string, draft = false): GuideEntry => ({
  id,
  data: {
    title: `Guía ${id}`,
    description: `Descripción de la guía ${id}`,
    date: new Date(date),
    image: '/og.png',
    draft,
  },
});

const entries = [
  guide('antigua', '2026-01-10'),
  guide('reciente', '2026-03-20'),
  guide('borrador', '2026-04-01', true),
  guide('media', '2026-02-15'),
];

describe('publishedGuides', () => {
  it('Scenario: Listado de guías - ordena de la más reciente a la más antigua', () => {
    const ids = publishedGuides(entries, true).map((entry) => entry.id);

    expect(ids).toEqual(['reciente', 'media', 'antigua']);
  });

  it('Scenario: Borradores fuera - en producción excluye los borradores', () => {
    const ids = publishedGuides(entries, true).map((entry) => entry.id);

    expect(ids).not.toContain('borrador');
  });

  it('en desarrollo conserva los borradores para poder revisarlos', () => {
    const ids = publishedGuides(entries, false).map((entry) => entry.id);

    expect(ids).toEqual(['borrador', 'reciente', 'media', 'antigua']);
  });

  it('no altera la lista original', () => {
    const copy = [...entries];

    publishedGuides(entries, true);

    expect(entries).toEqual(copy);
  });
});

describe('readingMinutes', () => {
  const words = (count: number) => Array.from({ length: count }, () => 'palabra').join(' ');

  it('calcula a 200 palabras por minuto, redondeando hacia arriba', () => {
    expect(readingMinutes(words(200))).toBe(1);
    expect(readingMinutes(words(201))).toBe(2);
    expect(readingMinutes(words(1000))).toBe(5);
  });

  it('devuelve al menos un minuto', () => {
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes(words(3))).toBe(1);
  });

  it('no cuenta la sintaxis de Markdown como palabras', () => {
    const markdown = `## ${words(100)}\n\n- ${words(50)}\n\n> **${words(50)}**\n\n---\n`;

    expect(readingMinutes(markdown)).toBe(1);
  });
});

describe('tableOfContents', () => {
  it('Scenario: Artículo - solo recoge los encabezados de segundo nivel', () => {
    const toc = tableOfContents([
      { depth: 1, slug: 'titulo', text: 'Título' },
      { depth: 2, slug: 'primera', text: 'Primera' },
      { depth: 3, slug: 'detalle', text: 'Detalle' },
      { depth: 2, slug: 'segunda', text: 'Segunda' },
    ]);

    expect(toc).toEqual([
      { slug: 'primera', text: 'Primera' },
      { slug: 'segunda', text: 'Segunda' },
    ]);
  });
});

describe('guidePath', () => {
  it('cuelga del listado de guías, sin barra final', () => {
    expect(guidePath('que-es-una-permuta')).toBe('/guias/que-es-una-permuta');
  });
});

describe('formatGuideDate', () => {
  it('escribe la fecha en español sin depender de la zona horaria', () => {
    expect(formatGuideDate(new Date('2026-03-01T00:00:00Z'))).toBe('1 de marzo de 2026');
  });
});

describe('articleJsonLd', () => {
  it('Scenario: Datos estructurados - describe el artículo con título, fecha, imagen y autor', () => {
    const data = articleJsonLd({
      title: 'Qué es una permuta',
      description: 'Explicación',
      date: new Date('2026-03-01T00:00:00Z'),
      image: 'https://changehouse.app/og.png',
      url: 'https://changehouse.app/guias/que-es-una-permuta',
    });

    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Qué es una permuta',
      description: 'Explicación',
      datePublished: '2026-03-01T00:00:00.000Z',
      image: ['https://changehouse.app/og.png'],
      author: { '@type': 'Organization', name: 'ChangeHouse' },
      mainEntityOfPage: 'https://changehouse.app/guias/que-es-una-permuta',
    });
  });
});

describe('serializeJsonLd', () => {
  it('escapa «<» para que el contenido no pueda cerrar la etiqueta script', () => {
    const json = serializeJsonLd({ headline: '</script><b>' });

    expect(json).not.toContain('<');
    expect(JSON.parse(json)).toEqual({ headline: '</script><b>' });
  });
});

describe('rssItems', () => {
  it('Scenario: Feed - un elemento por guía con título, descripción, fecha y enlace', () => {
    const items = rssItems([guide('reciente', '2026-03-20')]);

    expect(items).toEqual([
      {
        title: 'Guía reciente',
        description: 'Descripción de la guía reciente',
        pubDate: new Date('2026-03-20'),
        link: '/guias/reciente',
      },
    ]);
  });
});
