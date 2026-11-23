// Mapa de arquitectura del SPEC (docs/SPEC.md, sección Arquitectura) traducido a reglas:
// el núcleo es puro, la presentación no toca datos y Supabase solo se importa desde su adaptador.
// Los tests de cada carpeta quedan fuera de la regla del núcleo: necesitan vitest y fast-check.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'sin-ciclos',
      comment: 'Un ciclo impide probar y razonar sobre los módulos uno a uno.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'nucleo-puro',
      comment:
        'src/nucleo es lógica pura: no importa otras carpetas de src, paquetes de node_modules ni node:*.',
      severity: 'error',
      from: { path: '^src/nucleo/', pathNot: '\\.test\\.tsx?$' },
      to: { pathNot: '^src/nucleo/' },
    },
    {
      name: 'ui-sin-datos',
      comment: 'src/ui solo presenta: no llama a adaptadores, a casos de uso ni a Supabase.',
      severity: 'error',
      from: { path: '^src/ui/' },
      to: { path: '^(src/adaptadores|src/aplicacion)/|^node_modules/@supabase/' },
    },
    {
      name: 'aplicacion-sin-capas-superiores',
      comment: 'Los casos de uso no dependen de las rutas ni de los componentes.',
      severity: 'error',
      from: { path: '^src/aplicacion/' },
      to: { path: '^src/(app|ui)/' },
    },
    {
      name: 'adaptadores-sin-capas-superiores',
      comment:
        'Los adaptadores no dependen de las rutas, de los componentes ni de los casos de uso.',
      severity: 'error',
      from: { path: '^src/adaptadores/' },
      to: { path: '^src/(app|ui|aplicacion)/' },
    },
    {
      name: 'supabase-solo-en-su-adaptador',
      comment: 'Solo src/adaptadores/supabase importa @supabase/*.',
      severity: 'error',
      from: { pathNot: '^src/adaptadores/supabase/' },
      to: { path: '^node_modules/@supabase/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // scripts/puertas son las puertas de la casa copiadas tal cual, no código del repo.
    exclude: { path: '^scripts/puertas/' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    moduleSystems: ['cjs', 'es6'],
  },
};
