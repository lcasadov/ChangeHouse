import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { defineCollection } from 'astro:content';

// Las pruebas E2E construyen el sitio con guías de prueba publicadas (GUIAS_CONTENT_DIR);
// el resto de construcciones lee las guías reales.
const base = process.env.GUIAS_CONTENT_DIR ?? './src/content/guias';

const guias = defineCollection({
  loader: glob({ pattern: '*.md', base }),
  schema: z.object({
    title: z.string().min(5),
    description: z.string().min(40),
    date: z.coerce.date(),
    image: z.string().startsWith('/').default('/og.png'),
    draft: z.boolean().default(false),
  }),
});

export const collections = { guias };
