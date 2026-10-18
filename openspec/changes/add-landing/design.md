# Design

## Context

`apps/landing` ya existe (Astro 7) con la maquetación base, la paleta como
variables CSS alineadas con `packages/ui` y los textos en `src/i18n/es.ts`
(issue #16). No hay backend implicado. La motivación está en `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Una sola página principal larga y rápida (estática, sin JavaScript salvo el
  aviso de cookies y el acordeón accesible), más cuatro páginas legales.
- Consentimiento de cookies verificable automáticamente.

**Non-Goals:**
- Formulario de lista de espera (`add-waitlist`), blog (`add-landing-blog`),
  analítica real: solo se deja el punto de enganche que respeta el
  consentimiento.

## Decisions

- **Contenido en `src/i18n/es.ts`**, nunca en las plantillas: las pruebas
  comprueban la presencia de las claves y la regla RN-07 (sin «ahorro fiscal»)
  se verifica recorriendo todos los textos. Alternativa descartada: MDX por
  sección — más cómodo para redactar, pero dispersa el contenido y dificulta la
  comprobación automática.
- **Preguntas frecuentes con `<details>`/`<summary>`**: accesibles con teclado
  y lector de pantalla sin JavaScript. Se pierde la animación fina; se compensa
  con CSS respetando `prefers-reduced-motion`.
- **Consentimiento en un módulo TypeScript puro** (`src/lib/consent.ts`) que
  guarda la decisión en `localStorage` solo **después** de decidir (guardar la
  propia decisión es esencial); expone `getConsent`, `setConsent` y
  `onConsentChange`. El banner es un componente Astro con un script mínimo.
  Alternativa descartada: plataforma de consentimiento de terceros — añade
  cookies y peso antes de decidir, justo lo que se quiere evitar.
- **Pruebas en tres niveles**: unitarias del módulo de consentimiento y de los
  contenidos (Vitest); renderizado de componentes con la API de contenedor de
  Astro (Vitest); E2E con Playwright contra `astro preview` (teclado, 320 px,
  tema oscuro, cookies, `axe-core` para WCAG). Es el primer flujo E2E: deja
  configurado `pnpm test:e2e`.
- **SEO**: componente `Seo.astro` por página e integración oficial de sitemap.
  Imagen para compartir estática en `public/og.png`.

## Risks / Trade-offs

- [Textos legales y del fundador sin validar] → se publican marcados como
  borrador; la marca se retira cuando el negocio los apruebe.
- [Navegadores de Playwright pesados en CI] → solo Chromium; el job E2E se
  activa en PRs hacia `master` (estrategia de pruebas §7).
