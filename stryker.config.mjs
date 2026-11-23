import calidad from './calidad.json' with { type: 'json' };

// Mutación sobre las rutas N3 de calidad.json (el núcleo puro). Los tests no se mutan.
// Versiones exactas: vitest 4.1.11 con @stryker-mutator 10.1.1; con vitest 5 el score sale 0 %.

/** @type {import('@stryker-mutator/core').PartialStrykerOptions} */
const configuracion = {
  packageManager: 'npm',
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  mutate: [...calidad.mutacion.rutas, '!src/**/*.test.{ts,tsx}'],
  thresholds: {
    high: 80,
    low: 60,
    // Sale de calidad.json: sube según madura, nunca se baja.
    break: calidad.mutacion.break,
  },
  reporters: ['clear-text', 'html'],
  htmlReporter: {
    fileName: 'reports/mutation/index.html',
  },
  tempDirName: '.stryker-tmp',
};

export default configuracion;
