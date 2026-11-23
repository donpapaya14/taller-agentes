// Puerta "umbrales": compara la base con HEAD y marca como FALLO todo lo que relaja una puerta.
//
//   - calidad.json: cobertura o mutación que bajan, límites que suben, `excluir` u `omitir` que
//     crecen, `mutacion.rutas` que pierde entradas, `porArchivo` o `supabase` que se apagan,
//     `tipo` que cambia.
//   - Archivos de configuración protegidos (PATRONES_CONFIG sin calidad.json ni calidad-base.json,
//     que se comparan campo a campo; incluye las puertas en scripts/puertas): añadirlos,
//     modificarlos o borrarlos.
//   - package.json: scripts.test, scripts.check, scripts["check:full"] y scripts.lint.
//
// Excepción: una línea `UMBRAL: <ruta-o-clave> — <motivo>` AÑADIDA en el mismo diff a SPEC.md o
// docs/specs/*.md degrada a AVISO el hallazgo con esa ruta o clave. Una que ya estaba en la base
// no cuenta, y no hay otra vía de escape.
//
// Uso: node guarda-umbrales.mjs [--base <ref>] [--json <ruta>]
// Salida: 0 sin FALLO, 1 con FALLO, 2 si no se pudo evaluar (error de uso o de git).
import { matchesGlob, resolve } from 'node:path';
import {
  PATRONES_CONFIG,
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

const ID = 'umbrales';
const USO = 'Uso: node guarda-umbrales.mjs [--base <ref>] [--json <ruta>]';
const OPCIONES = { base: { type: 'string' }, json: { type: 'string' } };
const SCRIPTS_PROTEGIDOS = ['test', 'check', 'check:full', 'lint'];
const ARCHIVOS_SPEC = ['SPEC.md', ':(glob)docs/specs/*.md'];
const ACCIONES = { A: 'añadida', D: 'borrada' };
// calidad.json y calidad-base.json se comparan campo a campo (y endurecerlos es legítimo).
const COMPARADOS_APARTE = new Set(['calidad.json', 'calidad-base.json']);
const PATRONES_PROTEGIDOS = PATRONES_CONFIG.filter((patron) => !COMPARADOS_APARTE.has(patron));

const MINIMO = { relaja: (nuevo, previo) => nuevo < previo, verbo: 'baja' };
const MAXIMO = { relaja: (nuevo, previo) => nuevo > previo, verbo: 'sube' };

export function esArchivoProtegido(ruta) {
  return PATRONES_PROTEGIDOS.some((patron) => matchesGlob(ruta, patron));
}

const objeto = (valor) =>
  valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? valor : {};
const lista = (valor) => (Array.isArray(valor) ? valor : []);

// ---- calidad.json ----------------------------------------------------------------------------

function relajado(detalle, claves) {
  return { nivel: 'FALLO', regla: 'umbral-relajado', archivo: 'calidad.json', detalle, claves };
}

function numerosRelajados(seccion, base, head, { relaja, verbo }) {
  return Object.entries(base)
    .filter(([, previo]) => typeof previo === 'number')
    .flatMap(([nombre, previo]) => {
      const clave = `${seccion}.${nombre}`;
      const nuevo = head[nombre];
      if (typeof nuevo !== 'number') {
        return [relajado(`${clave} desaparece (era ${previo})`, [clave])];
      }
      return relaja(nuevo, previo)
        ? [relajado(`${clave} ${verbo} de ${previo} a ${nuevo}`, [clave])]
        : [];
    });
}

function porArchivoApagado(base, head) {
  if (base.porArchivo !== true || head.porArchivo === true) return [];
  return [relajado('cobertura.porArchivo deja de ser true', ['cobertura.porArchivo'])];
}

function excluirAnadido(base, head) {
  const previas = new Set(lista(base.excluir));
  const nuevas = lista(head.excluir).filter((entrada) => !previas.has(entrada));
  if (nuevas.length === 0) return [];
  return [relajado(`cobertura.excluir añade: ${nuevas.join(', ')}`, ['cobertura.excluir'])];
}

function rutasPerdidas(base, head) {
  const actuales = new Set(lista(head.rutas));
  const perdidas = lista(base.rutas).filter((ruta) => !actuales.has(ruta));
  if (perdidas.length === 0) return [];
  return [relajado(`mutacion.rutas pierde: ${perdidas.join(', ')}`, ['mutacion.rutas'])];
}

function omisionesNuevas(base, head) {
  const previas = objeto(base);
  return Object.keys(objeto(head))
    .filter((nombre) => !Object.hasOwn(previas, nombre))
    .map((nombre) => relajado(`omitir.${nombre} es una omisión nueva`, [`omitir.${nombre}`]));
}

function tipoCambiado(base, head) {
  if (base === head) return [];
  return [relajado(`tipo cambia de ${base} a ${head}`, ['tipo'])];
}

// Con supabase en true el gate exige la comprobación rls: apagarlo la quita sin tocar un umbral.
function supabaseApagado(base, head) {
  if (base !== true || head === true) return [];
  return [relajado('supabase deja de ser true', ['supabase'])];
}

export function compararCalidad(base, head) {
  const [cobBase, cobHead] = [objeto(base.cobertura), objeto(head.cobertura)];
  const [mutBase, mutHead] = [objeto(base.mutacion), objeto(head.mutacion)];
  const [limBase, limHead] = [objeto(base.limites), objeto(head.limites)];
  return [
    ...numerosRelajados('cobertura', cobBase, cobHead, MINIMO),
    ...porArchivoApagado(cobBase, cobHead),
    ...excluirAnadido(cobBase, cobHead),
    ...numerosRelajados('mutacion', mutBase, mutHead, MINIMO),
    ...rutasPerdidas(mutBase, mutHead),
    ...numerosRelajados('limites', limBase, limHead, MAXIMO),
    ...omisionesNuevas(base.omitir, head.omitir),
    ...tipoCambiado(base.tipo, head.tipo),
    ...supabaseApagado(base.supabase, head.supabase),
  ];
}

function calidadEnHead(base, head) {
  if (head === null) return [relajado('calidad.json borrado', ['calidad.json'])];
  if (head.error) return [relajado(`calidad.json no es JSON válido en HEAD: ${head.error}`, [])];
  return compararCalidad(objeto(base), objeto(head.valor));
}

// ---- package.json y archivos protegidos ------------------------------------------------------

function describirCambio(antes, despues) {
  if (antes === undefined) return `añadido: «${despues}»`;
  if (despues === undefined) return `eliminado (era «${antes}»)`;
  return `cambia de «${antes}» a «${despues}»`;
}

export function compararScripts(base, head) {
  return SCRIPTS_PROTEGIDOS.filter((nombre) => base[nombre] !== head[nombre]).map((nombre) => {
    const clave = `scripts.${nombre}`;
    return {
      nivel: 'FALLO',
      regla: 'script-protegido',
      archivo: 'package.json',
      detalle: `${clave} ${describirCambio(base[nombre], head[nombre])}`,
      claves: [clave, `package.json#${clave}`, 'package.json'],
    };
  });
}

const scriptsDe = (leido) => objeto(objeto(leido?.valor).scripts);

function scriptsEnHead(git, base) {
  const previo = leerJsonEnRev(git, base, 'package.json');
  if (previo === null || previo.error) return [];
  return compararScripts(scriptsDe(previo), scriptsDe(leerJsonEnRev(git, 'HEAD', 'package.json')));
}

function cambiosProtegidos(git, base) {
  const campos = git(['diff', '--name-status', '-z', '--no-renames', '--relative', base, 'HEAD'])
    .split('\0')
    .filter(Boolean);
  const cambios = [];
  for (let i = 0; i < campos.length; i += 2) {
    cambios.push({ estado: campos[i], ruta: campos[i + 1] });
  }
  return cambios
    .filter(({ ruta }) => esArchivoProtegido(ruta))
    .map(({ estado, ruta }) => ({
      nivel: 'FALLO',
      regla: 'config-protegida',
      archivo: ruta,
      detalle: `configuración protegida ${ACCIONES[estado] ?? 'modificada'}`,
      claves: [ruta],
    }));
}

// ---- Excepción UMBRAL ------------------------------------------------------------------------

export function extraerUmbrales(diff) {
  const anadidas = diff.split('\n').filter((linea) => linea.startsWith('+'));
  return umbralesDeLineas(anadidas.map((linea) => linea.slice(1)));
}

function umbralesAnadidos(git, base) {
  const argumentos = ['diff', '--no-color', '--no-ext-diff', '-U0', base, 'HEAD'];
  return extraerUmbrales(git([...argumentos, '--', ...ARCHIVOS_SPEC]));
}

// null si el archivo no existe en esa revisión; { error } si no es JSON; { valor } si lo es.
function leerJsonEnRev(git, rev, ruta) {
  const texto = leerEnRev(git, rev, ruta);
  if (texto === null) return null;
  try {
    return { valor: JSON.parse(texto) };
  } catch (error) {
    return { error: error.message };
  }
}

// ---- evaluación y línea de comandos ----------------------------------------------------------

function evaluar(git, explicita) {
  const base = resolverBase(git, explicita);
  if (base === null) return [baseAusente(explicita)];
  const calidadBase = leerJsonEnRev(git, base, 'calidad.json');
  if (calidadBase === null) {
    const detalle = 'sin base, primera adopción: la base no tiene calidad.json';
    return [hallazgo('AVISO', 'primera-adopcion', 'calidad.json', detalle)];
  }
  if (calidadBase.error) {
    const detalle = `calidad.json de la base no es JSON válido: ${calidadBase.error}`;
    return [hallazgo('FALLO', 'base-invalida', 'calidad.json', detalle)];
  }
  const hallazgos = [
    ...calidadEnHead(calidadBase.valor, leerJsonEnRev(git, 'HEAD', 'calidad.json')),
    ...cambiosProtegidos(git, base),
    ...scriptsEnHead(git, base),
  ];
  return aplicarUmbrales(hallazgos, umbralesAnadidos(git, base));
}

export function main(argv, { cwd, stdout, stderr }) {
  try {
    const opciones = leerOpciones(argv, OPCIONES, USO);
    const informe = crearInforme(ID, evaluar(crearGit(cwd), opciones.base));
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
