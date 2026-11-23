// Trinquete: las métricas globales de calidad solo pueden mejorar respecto a la base.
//
// Compara con el calidad-base.json que hay en la rama base (se lee con git show):
//   - duplicacionPct   jscpd, statistics.total.percentage   FALLO si sube más de 0,1
//   - knipIssues       knip, issues y archivos sin usar      FALLO si sube
//   - suppressions     suma de count en eslint-suppressions.json   FALLO si sube
//   - archivosGrandes  archivos fuente rastreados por git con más de limites.maxLineasArchivo
//                      líneas no vacías (300 si calidad.json no lo dice)   FALLO si uno crece o
//                      aparece uno nuevo que no estaba en la base
// Lo que mejora es OK. Si falta o es ilegible el informe de jscpd o de knip, FALLO.
//
// Con --actualizar, y solo si no hay FALLO, escribe calidad-base.json con las métricas actuales:
// así la base solo puede mejorar. Sin base todavía (primera vez) también la crea.
//
// Uso: node trinquete.mjs [--base <ref>] [--jscpd <ruta>] [--knip <ruta>] [--actualizar]
//                         [--json <ruta>]
// Salida: 0 sin FALLO, 1 con FALLO, 2 si no se pudo evaluar (error de uso o de git).
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import {
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
} from './lib/puerta.mjs';

const ID = 'trinquete';
const USO = [
  'Uso: node trinquete.mjs [--base <ref>] [--jscpd <ruta>] [--knip <ruta>]',
  '[--actualizar] [--json <ruta>]',
].join(' ');
const OPCIONES = {
  base: { type: 'string' },
  jscpd: { type: 'string', default: 'reports/jscpd/jscpd-report.json' },
  knip: { type: 'string', default: 'reports/knip.json' },
  actualizar: { type: 'boolean' },
  json: { type: 'string' },
};
const ARCHIVO_BASE = 'calidad-base.json';
const LIMITE_POR_DEFECTO = 300;
const TOLERANCIA_DUPLICACION = 0.1;
const EXTENSIONES_FUENTE = new Set('js ts mjs cjs jsx tsx vue svelte astro'.split(' '));
const CARPETAS_EXCLUIDAS = new Set(
  'node_modules dist .next coverage reports test tests __tests__'.split(' '),
);

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const esNumero = (valor) => typeof valor === 'number' && Number.isFinite(valor);
const fallo = (regla, archivo, detalle) => hallazgo('FALLO', regla, archivo, detalle);

// ---- Métricas ----------------------------------------------------------------------------------

export function duplicacionDe(informe) {
  const porcentaje = informe?.statistics?.total?.percentage;
  if (!esNumero(porcentaje)) throw new Error('falta statistics.total.percentage');
  return porcentaje;
}

// Cada entrada de `issues` (una por archivo) trae un array por tipo de problema; se suman todos,
// más los archivos sin usar. `issues` puede ser una lista o un objeto indexado por archivo.
export function contarIssuesKnip(informe) {
  if (!esObjeto(informe)) throw new Error('el informe no es un objeto');
  const sinUsar = Array.isArray(informe.files) ? informe.files.length : 0;
  const porArchivo = Object.values(informe.issues ?? {})
    .flatMap((entrada) => Object.values(entrada))
    .filter(Array.isArray)
    .reduce((total, problemas) => total + problemas.length, 0);
  return sinUsar + porArchivo;
}

// Formato de ESLint: { archivo: { regla: { count } } }. Se suma cada `count` numérico.
export function sumarSuppressions(json) {
  if (json === null || typeof json !== 'object') return 0;
  return Object.entries(json).reduce((total, [clave, valor]) => {
    const suma = clave === 'count' && typeof valor === 'number' ? valor : sumarSuppressions(valor);
    return total + suma;
  }, 0);
}

export const contarLineasNoVacias = (texto) =>
  texto.split('\n').filter((linea) => linea.trim() !== '').length;

export function esFuenteMedible(ruta) {
  const carpetas = ruta.split('/');
  const nombre = carpetas.pop();
  return (
    EXTENSIONES_FUENTE.has(extname(nombre).slice(1)) &&
    !/\.(?:test|spec)\./.test(nombre) &&
    !carpetas.some((carpeta) => CARPETAS_EXCLUIDAS.has(carpeta))
  );
}

function limiteDe(calidad) {
  const limite = calidad?.limites?.maxLineasArchivo;
  return esNumero(limite) ? limite : LIMITE_POR_DEFECTO;
}

function medirArchivosGrandes(git, cwd, limite) {
  const rutas = git(['ls-files', '-z'])
    .split('\0')
    .filter((ruta) => esFuenteMedible(ruta) && existsSync(resolve(cwd, ruta)));
  const grandes = {};
  for (const ruta of rutas) {
    const lineas = contarLineasNoVacias(readFileSync(resolve(cwd, ruta), 'utf8'));
    if (lineas > limite) grandes[ruta] = lineas;
  }
  return grandes;
}

// { valor } si se pudo leer, { hallazgo } si falta o no se entiende. `siFalta` hace opcional el
// archivo: si no existe, ese valor.
function leerInforme({ cwd, ruta, nombre, extraer, siFalta }) {
  const completa = resolve(cwd, ruta);
  if (!existsSync(completa)) {
    if (siFalta !== undefined) return { valor: siFalta };
    return { hallazgo: fallo('falta-informe', ruta, `falta ${nombre}: ${ruta}`) };
  }
  try {
    return { valor: extraer(JSON.parse(readFileSync(completa, 'utf8'))) };
  } catch (error) {
    const detalle = `no se puede leer ${nombre} (${ruta}): ${error.message}`;
    return { hallazgo: fallo('informe-invalido', ruta, detalle) };
  }
}

// Con cualquier entrada ilegible no hay métricas fiables: solo se devuelven los hallazgos.
function medir(git, cwd, opciones) {
  const duplicacion = leerInforme({
    cwd,
    ruta: opciones.jscpd,
    nombre: 'el informe de jscpd',
    extraer: duplicacionDe,
  });
  const knip = leerInforme({
    cwd,
    ruta: opciones.knip,
    nombre: 'el informe de knip',
    extraer: contarIssuesKnip,
  });
  const suppressions = leerInforme({
    cwd,
    ruta: 'eslint-suppressions.json',
    nombre: 'las suppressions de ESLint',
    extraer: sumarSuppressions,
    siFalta: 0,
  });
  const limite = leerInforme({
    cwd,
    ruta: 'calidad.json',
    nombre: 'los límites de calidad.json',
    extraer: limiteDe,
    siFalta: LIMITE_POR_DEFECTO,
  });
  const problemas = [duplicacion, knip, suppressions, limite].flatMap((l) => l.hallazgo ?? []);
  if (problemas.length > 0) return { hallazgos: problemas };
  return {
    hallazgos: [],
    metricas: {
      duplicacionPct: duplicacion.valor,
      knipIssues: knip.valor,
      suppressions: suppressions.valor,
      archivosGrandes: medirArchivosGrandes(git, cwd, limite.valor),
    },
  };
}

// ---- Comparación con la base -------------------------------------------------------------------

// Los porcentajes llevan error de coma flotante (2.1 - 2 = 0.10000000000000009): se redondea.
const redondear = (numero) => Math.round(numero * 1e6) / 1e6;

function compararDuplicacion(previo, actual) {
  if (redondear(actual - previo) <= TOLERANCIA_DUPLICACION) return [];
  const tolerancia = `se tolera hasta ${TOLERANCIA_DUPLICACION}`;
  const detalle = `la duplicación sube de ${previo} % a ${actual} % (${tolerancia})`;
  return [fallo('trinquete-duplicacion', '', detalle)];
}

function compararContador(regla, nombre, previo, actual) {
  if (actual <= previo) return [];
  return [fallo(regla, '', `${nombre} suben de ${previo} a ${actual}`)];
}

function compararArchivosGrandes(previos, actuales) {
  return Object.entries(actuales).flatMap(([ruta, lineas]) => {
    if (!Object.hasOwn(previos, ruta)) {
      const detalle = `archivo grande nuevo: ${lineas} líneas, y no estaba en la base`;
      return [fallo('trinquete-archivo-nuevo', ruta, detalle)];
    }
    if (lineas <= previos[ruta]) return [];
    return [fallo('trinquete-archivo-crece', ruta, `crece de ${previos[ruta]} a ${lineas} líneas`)];
  });
}

const CONTADORES = [
  { clave: 'knipIssues', regla: 'trinquete-knip', nombre: 'los issues de knip' },
  { clave: 'suppressions', regla: 'trinquete-suppressions', nombre: 'las suppressions de ESLint' },
];

export function compararMetricas(base, actual) {
  return [
    ...compararDuplicacion(base.duplicacionPct, actual.duplicacionPct),
    ...CONTADORES.flatMap(({ clave, regla, nombre }) =>
      compararContador(regla, nombre, base[clave], actual[clave]),
    ),
    ...compararArchivosGrandes(base.archivosGrandes, actual.archivosGrandes),
  ];
}

function esMetricas(valor) {
  const contadores = [valor?.duplicacionPct, valor?.knipIssues, valor?.suppressions];
  const grandes = valor?.archivosGrandes;
  return contadores.every(esNumero) && esObjeto(grandes) && Object.values(grandes).every(esNumero);
}

function parsearMetricas(texto) {
  const metricas = JSON.parse(texto);
  if (!esMetricas(metricas)) throw new Error('faltan métricas o alguna no es un número');
  return metricas;
}

// { metricas } de la base, o { hallazgo } si no hay base o no sirve.
function leerBase(git, explicita) {
  const commit = resolverBase(git, explicita);
  if (commit === null) return { hallazgo: baseAusente(explicita) };
  const texto = leerEnRev(git, commit, ARCHIVO_BASE);
  if (texto === null) {
    const detalle = `sin base: la base no tiene ${ARCHIVO_BASE}`;
    return { hallazgo: hallazgo('AVISO', 'sin-base', ARCHIVO_BASE, detalle) };
  }
  try {
    return { metricas: parsearMetricas(texto) };
  } catch (error) {
    const detalle = `${ARCHIVO_BASE} de la base no es válido: ${error.message}`;
    return { hallazgo: fallo('base-invalida', ARCHIVO_BASE, detalle) };
  }
}

// ---- Evaluación y línea de comandos ------------------------------------------------------------

function evaluar(git, cwd, opciones) {
  const medicion = medir(git, cwd, opciones);
  if (medicion.metricas === undefined) return { hallazgos: medicion.hallazgos };
  const base = leerBase(git, opciones.base);
  const hallazgos = base.metricas
    ? compararMetricas(base.metricas, medicion.metricas)
    : [base.hallazgo];
  return { hallazgos, metricas: medicion.metricas };
}

export function main(argv, { cwd, stdout, stderr }) {
  try {
    const opciones = leerOpciones(argv, OPCIONES, USO);
    const { hallazgos, metricas } = evaluar(crearGit(cwd), cwd, opciones);
    const informe = crearInforme(ID, hallazgos);
    stdout.write(`${formatearTexto(informe)}\n`);
    if (opciones.actualizar && informe.estado !== 'FALLO') {
      escribirInforme(resolve(cwd, ARCHIVO_BASE), metricas);
      stdout.write(`${ARCHIVO_BASE} actualizado\n`);
    }
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
