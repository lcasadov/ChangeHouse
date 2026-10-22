# Design

## Context

La landing es un sitio Astro 7 estático con i18n, SEO, accesibilidad y pruebas
Vitest + Playwright + axe (`add-landing`). Motivación en `proposal.md`.

## Decisions

- **Colección de contenido `guias`** (Astro Content Collections) en
  `src/content/guias/*.md` con esquema Zod: título, descripción, fecha,
  imagen, `draft`. En producción se excluyen los borradores con
  `import.meta.env.PROD`; en desarrollo se ven con una marca «Borrador».
- **Páginas**: `/guias` (listado de la más reciente a la más antigua, con
  título, fecha y resumen) y `/guias/[slug]` (índice de secciones generado de
  los encabezados, tiempo de lectura a 200 palabras por minuto y llamada a la
  lista de espera al final). Reutilizan el layout, los tokens y el i18n de la
  landing.
- **SEO**: metadatos por artículo, JSON-LD `Article` (título, fecha, imagen,
  autor «ChangeHouse»), inclusión en el sitemap existente y feed RSS en
  `/guias/rss.xml` con `@astrojs/rss`.
- **Contenido inicial**: tres guías en borrador revisable (qué es una permuta
  y cómo funciona en ChangeHouse, cadenas de tres, nociones fiscales
  orientativas) sin recomendar valores de escritura ni hablar de «ahorro
  fiscal» (RN-07); una prueba recorre todos los artículos y falla si aparece
  esa expresión.

## Risks / Trade-offs

- [Contenido fiscal sensible] → las guías quedan en borrador hasta su
  revisión por una persona.
