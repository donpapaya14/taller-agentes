// Detector de manipulación: busca en el diff los cambios que debilitan la evidencia en vez de
// mejorar el código. Reglas adaptadas de smixs/code-quality (scripts/lib/tamper.ts, licencia MIT),
// portadas a Node sin Bun y sin su bypass por mensaje de commit.
//
//   FALLO  archivo de test borrado, o renombrado a un nombre que no es de test
//   FALLO  bajan los casos (it, test, it.each, test.each) o las aserciones (expect, assert) de un
//          archivo de test; lo comentado no cuenta
//   FALLO  línea añadida en un test que lo desactiva (.only, .skip, .todo, xit, fit, ...)
//   FALLO  aserción debilitada: en un mismo bloque del diff se quita una fuerte (toBe, toEqual...)
//          y se añade una débil (toBeTruthy, toBeDefined...)
//   FALLO  línea añadida, en cualquier archivo, que silencia lint, tipos, cobertura o mutación
//   AVISO  vi.mock / jest.mock añadido en un test (mockear IO externo es legítimo)
//   FALLO  cambio en .gitleaks.toml o .gitleaksignore
//
// Excepción: una línea `UMBRAL: <ruta> — <motivo>` AÑADIDA en el mismo diff a SPEC.md o
// docs/specs/*.md degrada a AVISO los hallazgos de ese archivo. No hay bypass por mensaje de
// commit.
// Limitación: git entrecomilla los nombres con comillas, barras invertidas o caracteres de
// control; esos archivos no se pueden analizar y se marcan como FALLO en vez de dejarlos pasar.
//
// Uso: node detector-manipulacion.mjs [--base <ref> | --staged] [--json <ruta>]
// Salida: 0 sin FALLO, 1 con FALLO, 2 si no se pudo evaluar (error de uso o de git).
import { resolve } from 'node:path';
import {
  aplicarUmbrales,
  baseAusente,
  crearGit,
  crearInforme,
  escribirInforme,
  formatearTexto,
  hallazgo,
  leerEnRev,
  leerOpciones,
  resolverBase,
  seEjecutaDirectamente,
  umbralesDeLineas,
} from './lib/puerta.mjs';

const ID = 'manipulacion';
const USO = 'Uso: node detector-manipulacion.mjs [--base <ref> | --staged] [--json <ruta>]';
const OPCIONES = {
  base: { type: 'string' },
  staged: { type: 'boolean' },
  json: { type: 'string' },
};
const ACCIONES = { A: 'añadida', D: 'borrada', R: 'renombrada' };
const CONFIG_GITLEAKS = new Set(['.gitleaks.toml', '.gitleaksignore']);
const DIRECTORIOS_TEST = new Set(['test', 'tests', '__tests__']);
const ARGUMENTOS_DIFF = [
  'diff',
  '--no-color',
  '--no-ext-diff',
  '--no-textconv',
  '--relative',
  '-M',
  '-U0',
  '--src-prefix=a/',
  '--dst-prefix=b/',
];

const COMENTARIO_BLOQUE = /\/\*[\s\S]*?\*\//g;
const COMENTARIO_LINEA = /(?<!:)\/\/.*$/gm;
const CASOS = /(?<![\w$.])(?:it|test)\s*(?:\(|\.each\b)/g;
const ASERCIONES = /\bexpect\s*\(|\bassert\s*[.(]/g;
const DESACTIVAN_TESTS =
  /\.(?:only|skip|todo)\s*\(|(?<![\w$.])(?:xit|xdescribe|fit|fdescribe|(?:test|it)\.fails)\s*\(/;
const MOCKS = /(?<![\w$.])(?:vi|jest)\.mock\s*\(/;
const ASERCION_FUERTE = /\.(?:toBe|toEqual|toStrictEqual|toThrow|toMatchObject)\s*\(/;
const ASERCION_DEBIL =
  /\.(?:toBeTruthy|toBeDefined|toBeFalsy|toMatchSnapshot)\s*\(|\.not\.toThrow\s*\(/;
// Las directivas llevan corchetes (eslint[-]disable) para que este archivo no se marque a sí
// mismo cuando se copia a un proyecto: la regla mira las líneas añadidas de cualquier archivo.
const SILENCIADORES = new RegExp(
  [
    'eslint[-]disable',
    '@ts[-](?:ignore|expect[-]error|nocheck)',
    '(?:istanbul|v8|c8)[ ]ignore',
    'Stryker[ ]disable',
  ].join('|'),
);

// ---- Archivos de test y recuentos --------------------------------------------------------------

export function esArchivoTest(ruta) {
  if (ruta === null || !/\.(?:js|ts|mjs|cjs|jsx|tsx)$/.test(ruta)) return false;
  const carpetas = ruta.split('/');
  const nombre = carpetas.pop();
  const porNombre = /\.(?:test|spec)\.[^.]+$/.test(nombre);
  return porNombre || carpetas.some((carpeta) => DIRECTORIOS_TEST.has(carpeta));
}

// Un test comentado ya no es un test: se quitan los comentarios antes de contar. Las direcciones
// con `://` dentro de una cadena no son comentarios.
export function quitarComentarios(codigo) {
  return codigo.replace(COMENTARIO_BLOQUE, '').replace(COMENTARIO_LINEA, '');
}

const contarCoincidencias = (patron, codigo) =>
  (quitarComentarios(codigo).match(patron) ?? []).length;
export const contarCasos = (codigo) => contarCoincidencias(CASOS, codigo);
export const contarAserciones = (codigo) => contarCoincidencias(ASERCIONES, codigo);

// ---- Lectura del diff --------------------------------------------------------------------------

const CABECERAS = [
  ['new file mode ', () => ({ estado: 'A', anterior: null })],
  ['deleted file mode ', () => ({ estado: 'D', nuevo: null })],
  ['rename from ', (ruta) => ({ estado: 'R', anterior: ruta })],
  ['rename to ', (ruta) => ({ nuevo: ruta })],
];

function leerCabecera(archivo, linea) {
  const cabecera = CABECERAS.find(([prefijo]) => linea.startsWith(prefijo));
  if (cabecera) Object.assign(archivo, cabecera[1](linea.slice(cabecera[0].length)));
}

// `diff --git a/RUTA b/RUTA`. Es null en un renombrado (las dos rutas difieren y llegan en
// `rename from/to`) y cuando git entrecomilló el nombre.
function rutaDeCabecera(linea) {
  const resto = linea.slice('diff --git '.length);
  const ruta = resto.slice(2, (resto.length - 5) / 2 + 2);
  return resto === `a/${ruta} b/${ruta}` ? ruta : null;
}

// Cada archivo: { estado: A|M|D|R, anterior, nuevo, hunks: [{ inicio, quitadas, anadidas }] }.
// `anadidas` guarda el texto y el número de línea en el archivo nuevo.
export function parsearDiff(texto) {
  const archivos = [];
  let archivo = { hunks: [] }; // recoge lo que preceda a la primera cabecera, que se descarta
  let hunk = null;
  for (const linea of texto.split('\n')) {
    if (linea.startsWith('diff --git ')) {
      const ruta = rutaDeCabecera(linea);
      archivo = { estado: 'M', anterior: ruta, nuevo: ruta, hunks: [] };
      archivos.push(archivo);
      hunk = null;
    } else if (linea.startsWith('@@')) {
      hunk = { inicio: Number(/\+(\d+)/.exec(linea)[1]), quitadas: [], anadidas: [] };
      archivo.hunks.push(hunk);
    } else if (hunk === null) {
      leerCabecera(archivo, linea);
    } else if (linea.startsWith('+')) {
      hunk.anadidas.push({ texto: linea.slice(1), numero: hunk.inicio + hunk.anadidas.length });
    } else if (linea.startsWith('-')) {
      hunk.quitadas.push(linea.slice(1));
    }
  }
  return archivos;
}

// ---- Reglas ------------------------------------------------------------------------------------

const rutasDe = ({ anterior, nuevo }) => [...new Set([anterior, nuevo].filter(Boolean))];

const DETALLE_ILEGIBLE = 'git entrecomilló el nombre de un archivo y no se puede analizar';
const ILEGIBLE = { ...hallazgo('FALLO', 'ruta-ilegible', '', DETALLE_ILEGIBLE), claves: [] };

const RECUENTOS = [
  { regla: 'casos-reducidos', sujeto: 'los casos de test', contar: contarCasos },
  { regla: 'aserciones-reducidas', sujeto: 'las aserciones', contar: contarAserciones },
];

const REGLAS_DE_LINEA_EN_TEST = [
  {
    nivel: 'FALLO',
    regla: 'test-desactivado',
    patron: DESACTIVAN_TESTS,
    descripcion: 'desactiva tests',
  },
  { nivel: 'AVISO', regla: 'mock-anadido', patron: MOCKS, descripcion: 'añade mocks' },
];

const REGLA_SILENCIADAS = {
  nivel: 'FALLO',
  regla: 'comprobacion-silenciada',
  patron: SILENCIADORES,
  descripcion: 'silencia comprobaciones',
};

function reglaGitleaks({ estado, anterior, nuevo }) {
  const afectado = [anterior, nuevo].find((ruta) => CONFIG_GITLEAKS.has(ruta));
  if (afectado === undefined) return [];
  const detalle = `configuración de gitleaks ${ACCIONES[estado] ?? 'modificada'}`;
  return [hallazgo('FALLO', 'gitleaks-modificado', afectado, detalle)];
}

function reglaTestEliminado({ estado, anterior, nuevo }) {
  if (!esArchivoTest(anterior)) return [];
  if (estado === 'D') {
    return [hallazgo('FALLO', 'test-eliminado', anterior, 'archivo de test borrado')];
  }
  if (estado === 'R' && !esArchivoTest(nuevo)) {
    const detalle = `archivo de test renombrado a un nombre que no es de test: ${nuevo}`;
    return [hallazgo('FALLO', 'test-eliminado', anterior, detalle)];
  }
  return [];
}

function reglaRecuentos({ anterior, nuevo }, leer) {
  if (!esArchivoTest(anterior) || !esArchivoTest(nuevo)) return [];
  const antes = leer('antiguo', anterior);
  const despues = leer('nuevo', nuevo);
  return RECUENTOS.flatMap(({ regla, sujeto, contar }) => {
    const [previos, actuales] = [contar(antes), contar(despues)];
    if (actuales >= previos) return [];
    return [hallazgo('FALLO', regla, nuevo, `${sujeto} bajan de ${previos} a ${actuales}`)];
  });
}

function lineasQueCasan(archivo, patron) {
  return archivo.hunks
    .flatMap(({ anadidas }) => anadidas)
    .flatMap(({ texto, numero }) => {
      const coincidencia = patron.exec(texto);
      return coincidencia ? [{ numero, coincidencia: coincidencia[0] }] : [];
    });
}

function reglaDeLineas(archivo, { nivel, regla, patron, descripcion }) {
  const casos = lineasQueCasan(archivo, patron);
  if (casos.length === 0) return [];
  const [primera] = casos;
  const donde = `primera: línea ${primera.numero} («${primera.coincidencia}»)`;
  const detalle = `${descripcion} en ${casos.length} línea(s) añadida(s); ${donde}`;
  return [hallazgo(nivel, regla, archivo.nuevo, detalle)];
}

// "Mismo bloque" es el bloque contiguo del diff (-U0): la aserción fuerte se quita y la débil se
// añade juntas, que es lo que pasa al reescribir una aserción en el sitio.
function reglaDebilitada(archivo) {
  const bloques = archivo.hunks.filter(
    ({ quitadas, anadidas }) =>
      quitadas.some((linea) => ASERCION_FUERTE.test(linea)) &&
      anadidas.some(({ texto }) => ASERCION_DEBIL.test(texto)),
  );
  if (bloques.length === 0) return [];
  const donde = `primero: línea ${bloques[0].inicio}`;
  const detalle = `aserción debilitada en ${bloques.length} bloque(s) del diff; ${donde}`;
  return [hallazgo('FALLO', 'asercion-debilitada', archivo.nuevo, detalle)];
}

function reglasEnTest(archivo) {
  if (!esArchivoTest(archivo.nuevo)) return [];
  return [
    ...REGLAS_DE_LINEA_EN_TEST.flatMap((regla) => reglaDeLineas(archivo, regla)),
    ...reglaDebilitada(archivo),
  ];
}

function hallazgosDe(archivo, leer) {
  if (archivo.anterior === null && archivo.nuevo === null) return [ILEGIBLE];
  const claves = rutasDe(archivo);
  return [
    ...reglaGitleaks(archivo),
    ...reglaTestEliminado(archivo),
    ...reglaRecuentos(archivo, leer),
    ...reglaDeLineas(archivo, REGLA_SILENCIADAS),
    ...reglasEnTest(archivo),
  ].map((encontrado) => ({ ...encontrado, claves }));
}

// `leer(lado, ruta)` devuelve el contenido del archivo antes ('antiguo') o después ('nuevo').
const analizar = (archivos, leer) => archivos.flatMap((archivo) => hallazgosDe(archivo, leer));

// ---- Excepción UMBRAL --------------------------------------------------------------------------

const esArchivoSpec = (ruta) => ruta === 'SPEC.md' || /^docs\/specs\/[^/]+\.md$/.test(ruta ?? '');

export function extraerUmbrales(archivos) {
  const lineas = archivos
    .filter(({ nuevo }) => esArchivoSpec(nuevo))
    .flatMap(({ hunks }) => hunks.flatMap(({ anadidas }) => anadidas));
  return umbralesDeLineas(lineas.map(({ texto }) => texto));
}

// ---- git ---------------------------------------------------------------------------------------

function contextoDeRama(git, explicita) {
  const base = resolverBase(git, explicita);
  if (base === null) return null;
  return {
    rango: [base, 'HEAD'],
    leer: (lado, ruta) => leerEnRev(git, lado === 'antiguo' ? base : 'HEAD', ruta),
  };
}

// `git show :./ruta` lee el índice. Con HEAD sin nacer no hay lado antiguo, pero tampoco archivos
// modificados o renombrados que leer.
function contextoDeIndice(git) {
  return {
    rango: ['--cached'],
    leer: (lado, ruta) =>
      lado === 'antiguo' ? leerEnRev(git, 'HEAD', ruta) : git(['show', `:./${ruta}`]),
  };
}

// ---- Evaluación y línea de comandos ------------------------------------------------------------

function evaluar(git, { base, staged }) {
  const contexto = staged ? contextoDeIndice(git) : contextoDeRama(git, base);
  if (contexto === null) return [baseAusente(base)];
  const archivos = parsearDiff(git([...ARGUMENTOS_DIFF, ...contexto.rango]));
  const hallazgos = analizar(archivos, contexto.leer);
  return aplicarUmbrales(hallazgos, extraerUmbrales(archivos));
}

function leerArgumentos(argv) {
  const opciones = leerOpciones(argv, OPCIONES, USO);
  if (opciones.base && opciones.staged) {
    throw new Error(`--base y --staged se excluyen entre sí\n${USO}`);
  }
  return opciones;
}

export function main(argv, { cwd, stdout, stderr }) {
  try {
    const opciones = leerArgumentos(argv);
    const informe = crearInforme(ID, evaluar(crearGit(cwd), opciones));
    stdout.write(`${formatearTexto(informe)}\n`);
    if (opciones.json) escribirInforme(resolve(cwd, opciones.json), informe);
    return informe.estado === 'FALLO' ? 1 : 0;
  } catch (error) {
    stderr.write(`${ID}: ${error.message}\n`);
    return 2;
  }
}

if (seEjecutaDirectamente(import.meta.url)) {
  const entorno = { cwd: process.cwd(), stdout: process.stdout, stderr: process.stderr };
  process.exitCode = main(process.argv.slice(2), entorno);
}
