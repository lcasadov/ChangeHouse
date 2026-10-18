// Configuración única de ESLint 9 (flat config) para todo el monorepo.
// Cada paquete la hereda al ejecutar `eslint .` desde su directorio.
import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import vitest from 'eslint-plugin-vitest';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const INFRA_LIBS = [
  'fastify',
  'fastify/*',
  'drizzle-orm',
  'drizzle-orm/*',
  'firebase-admin',
  'firebase-admin/*',
  'stripe',
  'stripe/*',
];

const forbidLayers = (layers, message) =>
  layers
    .flatMap((layer) => [`**/${layer}`, `**/${layer}/**`])
    .map((group) => ({ group: [group], message }));

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/.astro/**',
      '**/web-build/**',
      '**/expo-env.d.ts',
      'db/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { sonarjs, 'simple-import-sort': simpleImportSort },
    rules: {
      'no-console': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'sonarjs/cognitive-complexity': ['error', 15],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Ficheros JS (configuración): sin información de tipos
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['packages/ui/**/*.{ts,tsx}', 'apps/mobile/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    plugins: { vitest },
    rules: {
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'error',
      'vitest/expect-expect': 'error',
      'vitest/no-identical-title': 'error',
      'vitest/valid-expect': 'error',
    },
  },
  // Fronteras hexagonales de la API (docs/architecture.md, I-1 a I-4)
  {
    files: ['services/api/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...forbidLayers(
              ['application', 'infrastructure', 'interfaces'],
              'El dominio no puede depender de application, infrastructure ni interfaces.',
            ),
            {
              group: INFRA_LIBS,
              message: 'El dominio no puede importar librerías de infraestructura.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['services/api/src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...forbidLayers(
              ['infrastructure', 'interfaces'],
              'application no puede depender de infrastructure ni de interfaces.',
            ),
            {
              group: INFRA_LIBS,
              message: 'application no puede importar librerías de infraestructura: usa puertos.',
            },
          ],
        },
      ],
    },
  },
  // Astro
  ...astro.configs.recommended,
  {
    files: ['**/*.astro'],
    ...tseslint.configs.disableTypeChecked,
  },
);
