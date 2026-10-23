import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';

import { es } from '../../i18n/es';
import { publishedGuides, rssItems } from '../../lib/guias';

export async function GET(context: APIContext) {
  const guides = publishedGuides(await getCollection('guias'), import.meta.env.PROD);
  return rss({
    title: es.guides.feedTitle,
    description: es.guides.description,
    site: context.site ?? context.url.origin,
    items: rssItems(guides),
    trailingSlash: false,
    customData: `<language>${es.lang}</language>`,
  });
}
