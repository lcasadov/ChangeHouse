/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// getViteConfig carga el plugin de Astro: permite renderizar .astro con la API de contenedor
export default getViteConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Las páginas .astro no se miden con Vitest; la lógica vive en src/lib
      include: ['src/lib/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      reporter: ['text', 'lcov'],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
