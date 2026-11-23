// Lo que comparten las puertas de calidad: la lista de configuración protegida y su huella, el
// acceso a git (base y lectura de revisiones), la forma de los informes y de las excepciones
// UMBRAL, y la comprobación de que un script se ha lanzado directamente.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { globSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const BASES_POR_DEFECTO = ['origin/main', 'main'];
const LINEA_UMBRAL = /^\s*(?:[-*]\s+)?UMBRAL:\s*(\S+)\s+[—–-]+\s+(\S.*?)\s*$/;

// ---- Configuración protegida -----------------------------------------------------------------

// Archivos cuya modificación cambia las reglas del juego, y también las puertas mismas, instaladas
// en scripts/puertas. Su huella va en el informe del gate y la guarda de umbrales prohíbe tocarlos,
// salvo calidad.json y calidad-base.json, que compara campo a campo. De package.json solo cuenta
// su objeto "scripts".
export const PATRONES_CONFIG = [
  'calidad.json',
  'calidad-base.json',
  'vitest.config.*',
  'stryker.config.*',
  'eslint.config.*',
  'eslint-suppressions.json',
  '.dependency-cruiser.*',
  'knip.json',
  '.jscpd.json',
  'lighthouserc*',
  '.lighthouserc*',
  'playwright.config.*',
  '.gitleaks.toml',
  '.gitleaksignore',
  '.github/workflows/*',
  '.husky/**',
  'scripts/puertas/**',
];

const comparar = (a, b) => {
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

// Rutas (relativas a cwd) de los archivos que casan con algún patrón, sin repetir y ordenadas.
// Los comodines también devuelven carpetas y enlaces rotos: solo valen los archivos.
export function archivosQueCasan(patrones, cwd) {
  const rutas = new Set();
  for (const patron of patrones) {
    for (const ruta of globSync(patron, { cwd })) {
      if (statSync(join(cwd, ruta), { throwIfNoEntry: false })?.isFile()) rutas.add(ruta);
    }
  }
  return [...rutas].sort();
}

// Serialización estable: no depende del orden de las claves ni del formato del archivo.
function scriptsDePackage(raiz) {
  try {
    const { scripts } = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
    if (scripts === null || typeof scripts !== 'object') return null;
    const ordenados = Object.entries(scripts).sort(([a], [b]) => comparar(a, b));
    return JSON.stringify(Object.fromEntries(ordenados));
  } catch {
    // Sin package.json o ilegible: no hay scripts que proteger.
    return null;
  }
}

export function calcularHashConfig(raiz) {
  const piezas = archivosQueCasan(PATRONES_CONFIG, raiz).map((ruta) => [
    ruta,
    readFileSync(join(raiz, ruta)),
  ]);
  const scripts = scriptsDePackage(raiz);
  if (scripts !== null) piezas.push(['package.json#scripts', scripts]);
  piezas.sort(([a], [b]) => comparar(a, b));

  const hash = createHash('sha256');
  for (const [ruta, contenido] of piezas) {
    // El NUL separa ruta y contenido: así "a"+"bc" no se confunde con "ab"+"c".
    hash.update(ruta).update('\0').update(contenido).update('\0');
  }
  return hash.digest('hex');
}

// ---- Ejecución directa -----------------------------------------------------------------------

// Se comparan las rutas reales de los dos lados: lanzado a través de un enlace simbólico, argv[1]
// y la URL del módulo no coinciden, y la puerta terminaría en silencio con código 0 sin haber
// comprobado nada.
export function seEjecutaDirectamente(importMetaUrl) {
  const entrada = process.argv[1];
  if (entrada === undefined) return false;
  try {
    return realpathSync(fileURLToPath(importMetaUrl)) === realpathSync(entrada);
  } catch {
    // argv[1] no es una ruta (node -e) o la URL no es de un archivo: no es un lanzamiento directo.
    return false;
  }
}

// ---- git -------------------------------------------------------------------------------------

export function crearGit(cwd) {
  return (argumentos) =>
    execFileSync('git', ['-c', 'core.quotePath=false', ...argumentos], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
}

// git sale con 1 cuando no hay respuesta (ref inexistente, sin ancestro común);
// cualquier otro fallo es un error real y se propaga.
function preguntar(git, argumentos) {
  try {
    return git(argumentos).trim();
  } catch (error) {
    if (error.status === 1) return null;
    throw error;
  }
}

// Commit contra el que se compara: el ancestro común de la base y HEAD (el `base...HEAD` de git),
// para que lo que cambió en la base después de ramificar no cuente como cambio de esta rama.
export function resolverBase(git, explicita) {
  for (const ref of explicita ? [explicita] : BASES_POR_DEFECTO) {
    const commit = preguntar(git, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    if (commit) return preguntar(git, ['merge-base', commit, 'HEAD']) ?? commit;
  }
  return null;
}

// Contenido de `ruta` (relativa al directorio de trabajo) en `rev`, o null si no existe allí.
export function leerEnRev(git, rev, ruta) {
  if (git(['ls-tree', '--name-only', rev, '--', ruta]).trim() === '') return null;
  return git(['show', `${rev}:./${ruta}`]);
}

// ---- Informes --------------------------------------------------------------------------------

export const hallazgo = (nivel, regla, archivo, detalle) => ({ nivel, regla, archivo, detalle });

function estadoDe(hallazgos) {
  if (hallazgos.some((h) => h.nivel === 'FALLO')) return 'FALLO';
  return hallazgos.length > 0 ? 'AVISO' : 'OK';
}

export const crearInforme = (id, hallazgos) => ({ id, estado: estadoDe(hallazgos), hallazgos });

export function baseAusente(explicita) {
  if (explicita) {
    return hallazgo('FALLO', 'base-inexistente', '', `la base indicada no existe: ${explicita}`);
  }
  const detalle = `sin base: no existe ${BASES_POR_DEFECTO.join(' ni ')}, no hay con qué comparar`;
  return hallazgo('AVISO', 'sin-base', '', detalle);
}

export function formatearTexto({ id, hallazgos }) {
  if (hallazgos.length === 0) return `OK ${id}: sin hallazgos`;
  return hallazgos
    .map(({ nivel, regla, archivo, detalle }) => {
      const lugar = archivo ? `${archivo}: ` : '';
      return `${nivel} [${regla}] ${lugar}${detalle}`;
    })
    .join('\n');
}

export function leerOpciones(argv, opciones, uso) {
  try {
    return parseArgs({ args: argv, options: opciones, strict: true }).values;
  } catch (error) {
    throw new Error(`${error.message}\n${uso}`);
  }
}

export function escribirArchivo(ruta, texto) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, texto);
}

export function escribirInforme(ruta, datos) {
  escribirArchivo(ruta, `${JSON.stringify(datos, null, 2)}\n`);
}

// ---- Excepción UMBRAL ------------------------------------------------------------------------

// Las líneas `UMBRAL: <clave> — <motivo>` (con viñeta opcional) entre las dadas.
export function umbralesDeLineas(lineas) {
  return lineas
    .map((linea) => LINEA_UMBRAL.exec(linea))
    .filter(Boolean)
    .map(([, clave, motivo]) => ({ clave: clave.replaceAll('`', ''), motivo }));
}

// Un FALLO cuya clave coincide con un UMBRAL pasa a AVISO. Las claves internas del hallazgo solo
// sirven para esto y no salen en el informe.
export function aplicarUmbrales(hallazgos, umbrales) {
  return hallazgos.map(({ claves, ...encontrado }) => {
    const umbral =
      encontrado.nivel === 'FALLO' ? umbrales.find((u) => claves.includes(u.clave)) : undefined;
    if (umbral === undefined) return encontrado;
    const detalle = `${encontrado.detalle} (aceptado por UMBRAL: ${umbral.motivo})`;
    return { ...encontrado, nivel: 'AVISO', detalle };
  });
}
