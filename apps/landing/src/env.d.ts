/// <reference types="astro/client" />

// Tipo de los componentes .astro para las herramientas que no usan el plugin de Astro
// (ESLint con información de tipos). `astro check` sigue resolviendo los ficheros reales.
declare module '*.astro' {
  import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

  const Component: AstroComponentFactory;
  export default Component;
}
