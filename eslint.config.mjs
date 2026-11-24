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
  {
    // src/nucleo decide y es puro (D-1). dependency-cruiser vigila lo que importa; esto vigila lo
    // que no necesita import: el reloj, el azar, el entorno y la red llegan por parámetro.
    files: ['src/nucleo/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message: 'Date.now() lee el reloj: el núcleo recibe la hora como parámetro.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            'new Date() sin argumentos lee el reloj: el núcleo recibe la fecha como parámetro.',
        },
        {
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message: 'Math.random() es azar sin semilla: el núcleo es determinista.',
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message:
            'El núcleo no lee el entorno (process.env): la configuración llega como parámetro.',
        },
        { name: 'fetch', message: 'El núcleo no hace red: los datos llegan como parámetro.' },
      ],
    },
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
