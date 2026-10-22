import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.int.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    passWithNoTests: true,
    globalSetup: ['test/global-setup.ts'],
    // Todos los ficheros comparten un único contenedor de PostgreSQL
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
