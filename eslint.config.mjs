import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import sonarjs from 'eslint-plugin-sonarjs';
import calidad from './calidad.json' with { type: 'json' };

const { limites } = calidad;

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  sonarjs.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mjs}'],
    rules: {
      'max-lines': [
        'error',
        { max: limites.maxLineasArchivo, skipBlankLines: true, skipComments: true },
      ],
      'max-lines-per-function': [
        'error',
        { max: limites.maxLineasFuncion, skipBlankLines: true, skipComments: true },
      ],
      complexity: ['error', limites.maxComplejidad],
      'sonarjs/cognitive-complexity': ['error', limites.maxCognitiva],
      'max-depth': ['error', limites.maxProfundidad],
      'max-params': ['error', limites.maxParametros],
      'no-empty': 'error',
      'no-console': 'error',
      'react/no-danger': 'error',
    },
  },
  {
    // El plugin de TypeScript solo se registra para los archivos .ts y .tsx.
    files: ['**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'coverage/**',
    'reports/**',
    '.stryker-tmp/**',
    // scripts/puertas son las puertas de la casa copiadas tal cual, no código del repo.
    'scripts/puertas/**',
  ]),
]);
