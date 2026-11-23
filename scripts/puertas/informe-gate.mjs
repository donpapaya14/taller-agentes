// Reúne los resultados de las puertas en gate-report.json y en un resumen para el GATE 3.
//
// Uso: node informe-gate.mjs --nivel rapido|completo --dir reports/gate
//        [--calidad calidad.json] [--sha <sha>] [--salida gate-report.json] [--resumen <ruta-md>]
//
// Sale con 1 si algún check requerido está en FALLO y con 2 si se usa mal.
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  calcularHashConfig,
  crearGit,
  escribirArchivo,
  escribirInforme,
  seEjecutaDirectamente,
} from './lib/puerta.mjs';

// Checks que debe traer cada nivel. "completo" suma lo suyo a lo de "rapido".
export const MATRIZ = {
  rapido: [
    'lint',
    'tests',
    'spec',
    'umbrales',
    'manipulacion',
    'trinquete',
    'arquitectura',
    'muerto',
    'duplicado',
    'secretos',
    'sast',
    'dependencias',
  ],
  rapidoConTsconfig: ['tipos'],
  rapidoConSupabase: ['rls'],
  completo: ['mutacion', 'e2e'],
  completoPorTipo: {
    web: ['dast', 'cabeceras', 'lighthouse', 'a11y', 'enlaces'],
    bot: ['carga', 'n8n'],
    api: ['dast', 'cabeceras', 'carga'],
  },
};

const USO =
  'Uso: node informe-gate.mjs --nivel rapido|completo --dir <informes> ' +
  '[--calidad calidad.json] [--sha <sha>] [--salida gate-report.json] [--resumen <ruta.md>]';
const NIVELES = ['rapido', 'completo'];
const TIPOS = Object.keys(MATRIZ.completoPorTipo);
// Los únicos estados que puede traer un informe. OMITIDA no está: solo la concede calidad.json.
const ESTADOS_DE_INFORME = ['OK', 'AVISO', 'FALLO'];
const ESTADOS_CON_DETALLE = new Set(['FALLO', 'AVISO']);

export function checksRequeridos(nivel, { tipo, supabase = false, tsconfig = false } = {}) {
  const requeridos = [...MATRIZ.rapido];
  if (tsconfig) requeridos.push(...MATRIZ.rapidoConTsconfig);
  if (supabase) requeridos.push(...MATRIZ.rapidoConSupabase);
  if (nivel === 'completo') {
    // hasOwn: el tipo viene de un JSON y no puede resolverse a "constructor" o similares.
    const propios = Object.hasOwn(MATRIZ.completoPorTipo, tipo) ? MATRIZ.completoPorTipo[tipo] : [];
    requeridos.push(...MATRIZ.completo, ...propios);
  }
  return requeridos;
}

const lineaDeHallazgo = (h) => `${h.nivel} ${h.regla} (${h.archivo}): ${h.detalle}`;

function textoDeSalida(json) {
  if (typeof json.salida === 'string') return json.salida;
  if (Array.isArray(json.hallazgos)) return json.hallazgos.map(lineaDeHallazgo).join('\n');
  return '';
}

function motivoDeInforme(json, estado) {
  if (Array.isArray(json.hallazgos)) {
    const cantidad = json.hallazgos.filter((h) => h.nivel === estado).length;
    return `${cantidad} ${cantidad === 1 ? 'hallazgo' : 'hallazgos'} ${estado}`;
  }
  return Number.isInteger(json.codigo) ? `código ${json.codigo}` : '';
}

// Acepta los dos formatos de informe: el de run-check y el de los scripts con --json.
export function normalizarInforme(json) {
  const datos = json !== null && typeof json === 'object' ? json : {};
  const duracionMs = Number.isFinite(datos.duracionMs) ? datos.duracionMs : 0;
  const salida = textoDeSalida(datos);
  if (!ESTADOS_DE_INFORME.includes(datos.estado)) {
    const motivo = `estado no reconocido: ${JSON.stringify(datos.estado)}`;
    return { estado: 'FALLO', motivo, duracionMs, salida };
  }
  const motivo = datos.estado === 'OK' ? '' : motivoDeInforme(datos, datos.estado);
  return { estado: datos.estado, motivo, duracionMs, salida };
}

const hayMotivo = (motivo) => typeof motivo === 'string' && motivo.trim() !== '';

function evaluarRequerido(id, informe, motivoOmision) {
  if (informe) {
    return { id, estado: informe.estado, motivo: informe.motivo, duracionMs: informe.duracionMs };
  }
  if (hayMotivo(motivoOmision)) {
    return { id, estado: 'OMITIDA', motivo: motivoOmision, duracionMs: 0 };
  }
  return { id, estado: 'FALLO', motivo: 'no se ejecutó', duracionMs: 0 };
}

function comoInformativo(id, informe) {
  const detalle = informe.motivo ? ` (${informe.motivo})` : '';
  const motivo = `informativo: no requerido en este nivel${detalle}`;
  return { id, estado: informe.estado, motivo, duracionMs: informe.duracionMs };
}

export function evaluarChecks({ requeridos, informes, omitir }) {
  const checks = requeridos.map((id) => evaluarRequerido(id, informes.get(id), omitir?.[id]));
  const informativos = [...informes]
    .filter(([id]) => !requeridos.includes(id))
    .map(([id, informe]) => comoInformativo(id, informe));
  const conSalida = [...informes].filter(([, informe]) => informe.salida !== '');
  const salidas = Object.fromEntries(conSalida.map(([id, informe]) => [id, informe.salida]));
  return { checks, informativos, salidas };
}

function problemaDeCalidad(nivel, { datos, error }) {
  if (error) return error;
  if (nivel === 'completo' && !TIPOS.includes(datos.tipo)) {
    return 'calidad.json: "tipo" debe ser web, bot o api';
  }
  return null;
}

export function generarReporte({ nivel, calidad, tsconfig, informes, sha, fecha, hashConfig }) {
  const datos = calidad.datos ?? {};
  const requeridos = checksRequeridos(nivel, {
    tipo: datos.tipo,
    supabase: datos.supabase === true,
    tsconfig,
  });
  const evaluados = evaluarChecks({ requeridos, informes, omitir: datos.omitir });

  const problema = problemaDeCalidad(nivel, calidad);
  const decisivos = problema
    ? [{ id: 'calidad', estado: 'FALLO', motivo: problema, duracionMs: 0 }, ...evaluados.checks]
    : evaluados.checks;
  const reporte = {
    sha,
    fecha,
    nivel,
    tipo: datos.tipo ?? null,
    hashConfig,
    resultado: decisivos.some((check) => check.estado === 'FALLO') ? 'FALLO' : 'OK',
    checks: [...decisivos, ...evaluados.informativos],
  };
  return { reporte, salidas: evaluados.salidas };
}

export function leerCalidad(ruta, etiqueta = ruta) {
  let texto;
  try {
    texto = readFileSync(ruta, 'utf8');
  } catch {
    return { datos: null, error: `no se puede leer ${etiqueta}` };
  }
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { datos: null, error: `${etiqueta} no es JSON válido` };
  }
  if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
    return { datos: null, error: `${etiqueta} debe ser un objeto JSON` };
  }
  return { datos, error: null };
}

function leerInforme(ruta) {
  try {
    return normalizarInforme(JSON.parse(readFileSync(ruta, 'utf8')));
  } catch (error) {
    return { estado: 'FALLO', motivo: 'informe ilegible', duracionMs: 0, salida: error.message };
  }
}

// El id de cada check es el nombre del archivo: run-check escribe <id>.json.
export function leerInformes(dir) {
  const informes = new Map();
  if (!existsSync(dir)) return informes;
  for (const nombre of readdirSync(dir).sort()) {
    if (nombre.endsWith('.json')) {
      informes.set(nombre.slice(0, -'.json'.length), leerInforme(join(dir, nombre)));
    }
  }
  return informes;
}

const escaparCelda = (texto) => texto.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');

// La valla del bloque de código ha de ser más larga que cualquier racha de comillas de la salida.
function valla(salida) {
  const rachas = salida.match(/`+/g) ?? [];
  return '`'.repeat(Math.max(3, ...rachas.map((racha) => racha.length + 1)));
}

function bloqueDetalle(check, salida) {
  const cerco = valla(salida);
  const lineas = [`<summary>${check.estado} ${check.id}</summary>`, '', cerco, salida, cerco, ''];
  return ['<details>', ...lineas, '</details>'].join('\n');
}

// hasOwn: un check llamado "toString" no puede heredar una salida.
const salidaDe = (salidas, id) => (Object.hasOwn(salidas, id) ? salidas[id] : '');

export function renderResumen(reporte, salidas = {}) {
  const cabecera = [
    `## Gate de calidad (${reporte.nivel}): ${reporte.resultado}`,
    '',
    `Commit \`${reporte.sha}\` · tipo ${reporte.tipo ?? 'sin declarar'} · ` +
      `config \`${reporte.hashConfig.slice(0, 12)}\` · ${reporte.fecha}`,
    '',
    '| Check | Estado | Motivo |',
    '|---|---|---|',
    ...reporte.checks.map((c) => `| ${c.id} | ${c.estado} | ${escaparCelda(c.motivo)} |`),
  ];
  const detalles = reporte.checks
    .filter((check) => ESTADOS_CON_DETALLE.has(check.estado) && salidaDe(salidas, check.id))
    .flatMap((check) => ['', bloqueDetalle(check, salidaDe(salidas, check.id))]);
  return `${[...cabecera, ...detalles].join('\n')}\n`;
}

export function parsearArgumentos(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      nivel: { type: 'string' },
      dir: { type: 'string' },
      calidad: { type: 'string', default: 'calidad.json' },
      sha: { type: 'string' },
      salida: { type: 'string', default: 'gate-report.json' },
      resumen: { type: 'string' },
    },
  });
  if (!NIVELES.includes(values.nivel)) throw new Error('--nivel debe ser rapido o completo');
  if (!values.dir) throw new Error('falta --dir <directorio con los informes>');
  return { ...values };
}

export const obtenerSha = (cwd) => crearGit(cwd)(['rev-parse', 'HEAD']).trim();

function resolverSha(indicado, leerSha, cwd) {
  if (indicado) return indicado;
  try {
    return leerSha(cwd);
  } catch {
    return null;
  }
}

// En el CI el resumen se AÑADE al de los pasos anteriores; con --resumen se escribe entero.
function publicarResumen(markdown, { resumen, cwd, env }) {
  if (resumen) {
    escribirArchivo(resolve(cwd, resumen), markdown);
  } else if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(env.GITHUB_STEP_SUMMARY, markdown);
  }
}

function textoParaConsola(reporte) {
  const lineas = reporte.checks.map(
    (c) => `${c.estado} ${c.id}${c.motivo ? `: ${c.motivo}` : ''}`,
  );
  return `${[...lineas, `Resultado: ${reporte.resultado}`].join('\n')}\n`;
}

export function main(
  argv,
  {
    cwd = process.cwd(),
    env = process.env,
    ahora = () => new Date(),
    leerSha = obtenerSha,
    out = (texto) => process.stdout.write(texto),
    err = (texto) => process.stderr.write(texto),
  } = {},
) {
  let argumentos;
  try {
    argumentos = parsearArgumentos(argv);
  } catch (error) {
    err(`Error: ${error.message}\n${USO}\n`);
    return 2;
  }
  const sha = resolverSha(argumentos.sha, leerSha, cwd);
  if (!sha) {
    err('Error: no se pudo obtener el SHA con git; pásalo con --sha\n');
    return 2;
  }

  const { reporte, salidas } = generarReporte({
    nivel: argumentos.nivel,
    calidad: leerCalidad(resolve(cwd, argumentos.calidad), argumentos.calidad),
    tsconfig: existsSync(join(cwd, 'tsconfig.json')),
    informes: leerInformes(resolve(cwd, argumentos.dir)),
    sha,
    fecha: ahora().toISOString(),
    hashConfig: calcularHashConfig(cwd),
  });
  escribirInforme(resolve(cwd, argumentos.salida), reporte);
  publicarResumen(renderResumen(reporte, salidas), { resumen: argumentos.resumen, cwd, env });
  out(textoParaConsola(reporte));
  return reporte.resultado === 'FALLO' ? 1 : 0;
}

if (seEjecutaDirectamente(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
