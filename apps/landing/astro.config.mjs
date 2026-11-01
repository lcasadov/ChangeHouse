// @ts-check
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://changehouse.app',
  trailingSlash: 'never',
  integrations: [sitemap()],
  // Sin scripts en línea: la CSP de Hosting usa `script-src 'self'` (firebase.json)
  vite: { build: { assetsInlineLimit: 0 } },
});
