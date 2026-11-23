// Cruza los criterios del SPEC (filas C-n) con los tests que llevan [C-n] en el nombre
// y reescribe el bloque de estado generado dentro del propio SPEC.
//
// Uso: node spec-check.mjs [--specs SPEC.md,docs/specs/*.md] [--vitest reports/vitest.json]
//        [--playwright reports/playwright.json] [--no-escribir] [--json out]
//
// Sale con 1 si algún criterio está ROJO o SIN TEST, o si el formato del SPEC es incorrecto.
// Sale con 2 si se usa mal.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  archivosQueCasan,
  crearInforme,
  escribirInforme,
  hallazgo,
  seEjecutaDirectamente,
} from './lib/puerta.mjs';

export const ID_CRITERIO = /^[A-Z]{1,4}-\d+$/;

const USO =
  'Uso: node spec-check.mjs [--specs SPEC.md,docs/specs/*.md] [--vitest reports/vitest.json] ' +
  '[--playwright reports/playwright.json] [--no-escribir] [--json out]';
const SPECS_POR_DEFECTO = 'SPEC.md,docs/specs/*.md';
const VITEST_POR_DEFECTO = 'reports/vitest.json';
const PLAYWRIGHT_POR_DEFECTO = 'reports/playwright.json';
const ESTADOS = ['VERIFICADO', 'ROJO', 'SIN TEST', 'MANUAL', 'OMITIDO'];

const MARCA_INICIO = '<!-- estado:inicio -->';
const MARCA_FIN = '<!-- estado:fin -->';
const RE_INICIO = /<!--\s*estado:inicio\s*-->/g;
const RE_FIN = /<!--\s*estado:fin\s*-->/g;
const RE_FILA_ESTADO =
  /^\|\s*([A-Z]{1,4}-\d+)\s*\|\s*([^|]+?)\s*\|\s*\d+\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|$/;
const RE_DEMUESTRA = /c[oó]mo se demuestra/i;
const RE_VALLA = /^ {0,3}(`{3,}|~{3,})/;
const RE_OMITIDO = /omitido:(.*)$/i;
const RE_MANUAL = /manual:(.*)$/i;
const DETALLE_MARCADORES =
  'los marcadores <!-- estado:inicio --> y <!-- estado:fin --> ' +
  'deben aparecer una vez cada uno y en ese orden';

const soloSaltos = (texto) => texto.replace(/[^\n]/g, '');
const hayLetras = (texto) => /[\p{L}\p{N}]/u.test(texto);
const limpiar = (texto) => texto.replace(/^[\s`*_]+|[\s`*_]+$/g, '');

// ---------------------------------------------------------------------------------------------
// Bloque de estado generado
// ---------------------------------------------------------------------------------------------

export function localizarBloque(texto) {
  const inicios = [...texto.matchAll(RE_INICIO)];
  const fines = [...texto.matchAll(RE_FIN)];
  if (inicios.length === 0 && fines.length === 0) return { estado: 'ausente' };

  const [inicio] = inicios;
  const [fin] = fines;
  // Con marcadores a medias no se sabe qué hay que reemplazar: mejor no tocar nada.
  if (inicios.length !== 1 || fines.length !== 1 || fin.index < inicio.index) {
    return { estado: 'malformado' };
  }
  return { estado: 'ok', inicio: inicio.index, fin: fin.index + fin[0].length };
}

function resumenDeEstados(filas) {
  const cuentas = ESTADOS.map(
    (estado) => `${filas.filter((fila) => fila.estado === estado).length} ${estado}`,
  );
  return `${filas.length} ${filas.length === 1 ? 'criterio' : 'criterios'}: ${cuentas.join(', ')}.`;
}

// La fecha de cada fila es la del último cambio de SU estado: así una pasada que no cambia
// nada deja el archivo idéntico, aunque sea otro día.
function fechaDeFila(fila, previo, hoy) {
  const anterior = previo.get(fila.id);
  return anterior?.estado === fila.estado ? anterior.fecha : hoy;
}

export function renderBloque(filas, previo, hoy) {
  return [
    MARCA_INICIO,
    '| ID | Estado | Tests (n) | Fecha |',
    '|---|---|---|---|',
    ...filas.map((f) => `| ${f.id} | ${f.estado} | ${f.tests} | ${fechaDeFila(f, previo, hoy)} |`),
    '',
    `Resumen: ${resumenDeEstados(filas)}`,
    MARCA_FIN,
  ].join('\n');
}

export function leerBloquePrevio(texto, bloque) {
  const previo = new Map();
  if (bloque.estado !== 'ok') return previo;
  for (const linea of texto.slice(bloque.inicio, bloque.fin).split('\n')) {
    const fila = linea.trim().match(RE_FILA_ESTADO);
    if (fila) previo.set(fila[1], { estado: fila[2], fecha: fila[3] });
  }
  return previo;
}

// El bloque no puede ser "malformado": quien llama ya lo descartó.
export function actualizarBloque(texto, bloque, filas, hoy) {
  const nuevo = renderBloque(filas, leerBloquePrevio(texto, bloque), hoy);
  if (bloque.estado === 'ok') {
    return texto.slice(0, bloque.inicio) + nuevo + texto.slice(bloque.fin);
  }
  return `${texto.trimEnd()}\n\n## Estado (generado)\n\n${nuevo}\n`;
}

// ---------------------------------------------------------------------------------------------
// Lectura de los criterios del SPEC
// ---------------------------------------------------------------------------------------------

// Lo que no se ve en el markdown renderizado no cuenta: el propio bloque generado (si no, sus
// filas se leerían como criterios repetidos), los comentarios HTML y el código. Se conservan los
// saltos de línea para que los números de línea sigan siendo los del archivo.
function sinBloque(texto, bloque) {
  if (bloque.estado !== 'ok') return texto;
  const hueco = soloSaltos(texto.slice(bloque.inicio, bloque.fin));
  return texto.slice(0, bloque.inicio) + hueco + texto.slice(bloque.fin);
}

const sinComentarios = (texto) => texto.replace(/<!--[\s\S]*?-->/g, soloSaltos);

function cierraValla(linea, apertura) {
  const texto = linea.trim();
  const mismoTipo = texto.length >= apertura.length && texto[0] === apertura[0];
  return mismoTipo && texto === texto[0].repeat(texto.length);
}

function sinCodigo(lineas) {
  let apertura = null;
  return lineas.map((linea) => {
    if (apertura === null) {
      apertura = linea.match(RE_VALLA)?.[1] ?? null;
      return apertura === null ? linea : '';
    }
    if (cierraValla(linea, apertura)) apertura = null;
    return '';
  });
}

function celdasDeFila(texto) {
  const interior = texto.replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  return interior.split(/(?<!\\)\|/).map((celda) => celda.trim());
}

function esSeparador(texto) {
  return texto.startsWith('|') && celdasDeFila(texto).every((celda) => /^:?-+:?$/.test(celda));
}

// Filas de datos de las tablas markdown, cada una con la columna "Cómo se demuestra" de su cabecera.
function filasDeTablas(lineas) {
  const filas = [];
  let columna = -1;
  for (const [indice, linea] of lineas.entries()) {
    const texto = linea.trim();
    if (!texto.startsWith('|')) {
      columna = -1;
      continue;
    }
    if (esSeparador(texto)) continue;
    const celdas = celdasDeFila(texto);
    if (esSeparador((lineas[indice + 1] ?? '').trim())) {
      columna = celdas.findIndex((celda) => RE_DEMUESTRA.test(celda));
    } else {
      filas.push({ numero: indice + 1, celdas, columna });
    }
  }
  return filas;
}

// Tolera **C-1** o `C-1`: si no, un criterio con formato se saltaría la puerta sin avisar.
function idDeCelda(celda) {
  const id = celda.replace(/^[*_`]+|[*_`]+$/g, '');
  return ID_CRITERIO.test(id) ? id : null;
}

function leerMarca(celda) {
  const omitido = celda.match(RE_OMITIDO);
  if (omitido) return { tipo: 'omitido', motivo: limpiar(omitido[1]) };
  const manual = celda.match(RE_MANUAL);
  if (manual) return { tipo: 'manual', texto: limpiar(manual[1]) };
  return null;
}

function extraerCriterios(lineas, archivo) {
  const criterios = [];
  const hallazgos = [];
  const lineaDe = new Map();
  for (const { numero, celdas, columna } of filasDeTablas(lineas)) {
    const id = idDeCelda(celdas[0]);
    if (id === null) continue;
    if (lineaDe.has(id)) {
      const detalle = `${id} aparece dos veces (líneas ${lineaDe.get(id)} y ${numero})`;
      hallazgos.push(hallazgo('FALLO', 'id-duplicado', archivo, detalle));
      continue;
    }
    lineaDe.set(id, numero);
    // Sin cabecera "Cómo se demuestra" se miran todas las celdas menos la del ID.
    const celda = columna >= 0 ? (celdas[columna] ?? '') : celdas.slice(1).join(' | ');
    const marca = leerMarca(celda);
    if (marca?.tipo === 'omitido' && !hayLetras(marca.motivo)) {
      const detalle = `${id}: «omitido:» necesita un motivo`;
      hallazgos.push(hallazgo('FALLO', 'omitido-sin-motivo', archivo, detalle));
      criterios.push({ id, linea: numero, marca: null });
    } else {
      criterios.push({ id, linea: numero, marca });
    }
  }
  return { criterios, hallazgos };
}

export function analizarSpec(texto, archivo) {
  const bloque = localizarBloque(texto);
  if (bloque.estado === 'malformado') {
    const fallo = hallazgo('FALLO', 'marcadores-estado', archivo, DETALLE_MARCADORES);
    return { bloque, criterios: [], hallazgos: [fallo] };
  }
  const lineas = sinCodigo(sinComentarios(sinBloque(texto, bloque)).split('\n'));
  return { bloque, ...extraerCriterios(lineas, archivo) };
}

// ---------------------------------------------------------------------------------------------
// Lectura de los informes de tests
// ---------------------------------------------------------------------------------------------

function resultadoVitest(status) {
  return status === 'passed' || status === 'failed' ? status : 'skipped';
}

export function leerVitest(informe) {
  if (!Array.isArray(informe?.testResults)) {
    throw new Error('no es un informe JSON de vitest (falta testResults)');
  }
  return informe.testResults.flatMap((archivo) =>
    (archivo.assertionResults ?? []).map((prueba) => ({
      nombre: String(prueba.fullName ?? ''),
      resultado: resultadoVitest(prueba.status),
    })),
  );
}

// "flaky" pasó al reintentar y Playwright lo da por bueno. Un estado desconocido nunca pasa.
const RESULTADO_PLAYWRIGHT = new Map([
  ['expected', 'passed'],
  ['flaky', 'passed'],
  ['skipped', 'skipped'],
  ['unexpected', 'failed'],
]);

// Hay un test por proyecto (chromium, firefox...) y cada uno cuenta. El "ok" del spec no sirve
// solo: un test saltado también lo trae a true.
function pruebasDeSpec(spec, titulos) {
  const nombre = [...titulos, spec.title].join(' ');
  const tests = spec.tests?.length > 0 ? spec.tests : [{ status: spec.ok ? 'expected' : 'unexpected' }];
  return tests.map((prueba) => ({
    nombre,
    resultado: RESULTADO_PLAYWRIGHT.get(prueba.status) ?? 'failed',
  }));
}

function recorrerSuite(suite, ancestros) {
  const titulos = [...ancestros, suite.title];
  const propias = (suite.specs ?? []).flatMap((spec) => pruebasDeSpec(spec, titulos));
  const hijas = (suite.suites ?? []).flatMap((hija) => recorrerSuite(hija, titulos));
  return [...propias, ...hijas];
}

export function leerPlaywright(informe) {
  if (!Array.isArray(informe?.suites)) {
    throw new Error('no es un informe JSON de Playwright (falta suites)');
  }
  return informe.suites.flatMap((suite) => recorrerSuite(suite, []));
}

// ---------------------------------------------------------------------------------------------
// Estado de cada criterio
// ---------------------------------------------------------------------------------------------

// Las marcas mandan: un criterio manual u omitido no depende de los tests.
function estadoDe(marca, rojos, validos) {
  if (marca) return marca.tipo === 'omitido' ? 'OMITIDO' : 'MANUAL';
  if (rojos.length > 0) return 'ROJO';
  return validos > 0 ? 'VERIFICADO' : 'SIN TEST';
}

// Un test cubre un criterio si su nombre lleva la etiqueta entre corchetes: con ellos
// [C-1] no se confunde con [C-10]. Los saltados no cubren nada.
export function calcularEstados(criterios, tests) {
  return criterios.map(({ id, marca }) => {
    const propios = tests.filter((prueba) => prueba.nombre.includes(`[${id}]`));
    const rojos = propios.filter((p) => p.resultado === 'failed').map((p) => p.nombre);
    const validos = propios.filter((p) => p.resultado !== 'skipped').length;
    const saltados = propios.length - validos;
    return { id, estado: estadoDe(marca, rojos, validos), tests: validos, saltados, rojos, marca };
  });
}

function explicarSinTest({ id, saltados }) {
  return saltados > 0 ? 'solo tiene tests saltados' : `ningún test lleva [${id}]`;
}

function hallazgoDeFila(fila, archivo) {
  switch (fila.estado) {
    case 'SIN TEST':
      return hallazgo('FALLO', 'sin-test', archivo, `${fila.id} SIN TEST: ${explicarSinTest(fila)}`);
    case 'ROJO':
      return hallazgo('FALLO', 'rojo', archivo, `${fila.id} ROJO: fallan ${fila.rojos.join('; ')}`);
    case 'MANUAL':
      return hallazgo('AVISO', 'manual', archivo, `${fila.id} MANUAL: ${fila.marca.texto}`);
    case 'OMITIDO':
      return hallazgo('AVISO', 'omitido', archivo, `${fila.id} OMITIDO: ${fila.marca.motivo}`);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Línea de comandos
// ---------------------------------------------------------------------------------------------

export function parsearArgumentos(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      specs: { type: 'string', default: SPECS_POR_DEFECTO },
      vitest: { type: 'string' },
      playwright: { type: 'string' },
      'no-escribir': { type: 'boolean' },
      json: { type: 'string' },
    },
  });
  return { ...values };
}

const expandirSpecs = (lista, cwd) =>
  archivosQueCasan(lista.split(',').map((patron) => patron.trim()).filter(Boolean), cwd);

// El informe por defecto puede no existir (un proyecto sin e2e): no es ruido. El que se
// indica a mano sí tiene que existir.
function cargarInforme({ ruta, indicado, lector }, cwd) {
  const completa = resolve(cwd, ruta);
  if (!existsSync(completa)) {
    const ausente = hallazgo('FALLO', 'informe-ausente', ruta, 'no se encuentra el informe indicado');
    return { tests: [], hallazgos: indicado ? [ausente] : [] };
  }
  try {
    return { tests: lector(JSON.parse(readFileSync(completa, 'utf8'))), hallazgos: [] };
  } catch (error) {
    return { tests: [], hallazgos: [hallazgo('FALLO', 'informe-ilegible', ruta, error.message)] };
  }
}

function cargarTests({ vitest, playwright }, cwd) {
  const informes = [
    { ruta: vitest ?? VITEST_POR_DEFECTO, indicado: vitest !== undefined, lector: leerVitest },
    {
      ruta: playwright ?? PLAYWRIGHT_POR_DEFECTO,
      indicado: playwright !== undefined,
      lector: leerPlaywright,
    },
  ].map((informe) => cargarInforme(informe, cwd));
  return {
    tests: informes.flatMap((informe) => informe.tests),
    hallazgos: informes.flatMap((informe) => informe.hallazgos),
  };
}

function procesarSpec({ archivo, tests, cwd, hoy, escribir }) {
  const ruta = join(cwd, archivo);
  const texto = readFileSync(ruta, 'utf8');
  const analisis = analizarSpec(texto, archivo);
  if (analisis.bloque.estado === 'malformado') {
    return { hallazgos: analisis.hallazgos, filas: [], escrito: false };
  }

  const filas = calcularEstados(analisis.criterios, tests);
  const deFilas = filas.map((fila) => hallazgoDeFila(fila, archivo)).filter(Boolean);
  const resultado = { hallazgos: [...analisis.hallazgos, ...deFilas], filas, escrito: false };

  // Un archivo sin criterios solo se toca si ya tenía bloque, para no dejarlo desactualizado.
  const sinNadaQueEscribir = filas.length === 0 && analisis.bloque.estado !== 'ok';
  if (!escribir || sinNadaQueEscribir) return resultado;

  const nuevo = actualizarBloque(texto, analisis.bloque, filas, hoy);
  if (nuevo === texto) return resultado;
  writeFileSync(ruta, nuevo);
  return { ...resultado, escrito: true };
}

function fechaLocal(fecha) {
  const dos = (numero) => String(numero).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

function textoParaConsola(hallazgos, filas, actualizados) {
  return `${[
    ...hallazgos.map((h) => `${h.nivel} ${h.archivo}: ${h.detalle}`),
    `spec-check: ${resumenDeEstados(filas)}`,
    ...actualizados.map((archivo) => `Bloque de estado actualizado en ${archivo}.`),
  ].join('\n')}\n`;
}

export function main(
  argv,
  {
    cwd = process.cwd(),
    hoy = fechaLocal(new Date()),
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

  const archivos = expandirSpecs(argumentos.specs, cwd);
  const informes = cargarTests(argumentos, cwd);
  const hallazgos = [...informes.hallazgos];
  if (archivos.length === 0) {
    const detalle = 'no hay ningún archivo de spec que comprobar';
    hallazgos.push(hallazgo('FALLO', 'sin-spec', argumentos.specs, detalle));
  }

  const filas = [];
  const actualizados = [];
  for (const archivo of archivos) {
    const escribir = !argumentos['no-escribir'];
    const resultado = procesarSpec({ archivo, tests: informes.tests, cwd, hoy, escribir });
    hallazgos.push(...resultado.hallazgos);
    filas.push(...resultado.filas);
    if (resultado.escrito) actualizados.push(archivo);
  }

  if (argumentos.json) {
    escribirInforme(resolve(cwd, argumentos.json), crearInforme('spec', hallazgos));
  }
  out(textoParaConsola(hallazgos, filas, actualizados));
  return hallazgos.some((h) => h.nivel === 'FALLO') ? 1 : 0;
}

if (seEjecutaDirectamente(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
