import { SITE_NAME } from './page-title';

export interface GuideData {
  title: string;
  description: string;
  date: Date;
  image: string;
  draft: boolean;
}

export interface GuideEntry {
  id: string;
  data: GuideData;
}

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export interface TocItem {
  slug: string;
  text: string;
}

const WORDS_PER_MINUTE = 200;

/** Guías visibles, de la más reciente a la más antigua. Los borradores solo se ven fuera de producción. */
export function publishedGuides<T extends GuideEntry>(entries: readonly T[], isProd: boolean): T[] {
  return entries
    .filter((entry) => !isProd || !entry.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/** Minutos de lectura a 200 palabras por minuto (mínimo uno), ignorando la sintaxis de Markdown. */
export function readingMinutes(markdown: string): number {
  const words = markdown
    .replaceAll(/[#>*_`|-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/** Índice de secciones: los encabezados de segundo nivel. */
export function tableOfContents(headings: readonly Heading[]): TocItem[] {
  return headings
    .filter((heading) => heading.depth === 2)
    .map(({ slug, text }) => ({ slug, text }));
}

export const guidePath = (id: string): string => `/guias/${id}`;

export function formatGuideDate(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

/** Fecha ISO (AAAA-MM-DD) para el atributo `datetime`. */
export const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

interface ArticleInput {
  title: string;
  description: string;
  date: Date;
  /** URL absoluta de la imagen. */
  image: string;
  /** URL absoluta del artículo. */
  url: string;
}

export function articleJsonLd(input: ArticleInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    datePublished: input.date.toISOString(),
    image: [input.image],
    author: { '@type': 'Organization', name: SITE_NAME },
    mainEntityOfPage: input.url,
  };
}

/** Serializa JSON-LD para incrustarlo en un `<script>` sin que el contenido pueda cerrarlo. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replaceAll('<', '\\u003c');
}

export function rssItems(guides: readonly GuideEntry[]) {
  return guides.map(({ id, data }) => ({
    title: data.title,
    description: data.description,
    pubDate: data.date,
    link: guidePath(id),
  }));
}
