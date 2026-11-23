// Ejecuta un comando de una puerta y deja su resultado en <out>/<id>.json.
//
// Uso: node run-check.mjs <id> --out reports/gate -- <comando> [args...]
//
// Sale siempre con 0 aunque el comando falle: el veredicto lo da informe-gate.
// Solo sale con 2 si el propio run-check se usa mal.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { escribirInforme, seEjecutaDirectamente } from './lib/puerta.mjs';

export const MAX_LINEAS_SALIDA = 80;

const USO = 'Uso: node run-check.mjs <id> --out <directorio> -- <comando> [args...]';
// El id acaba siendo un nombre de archivo: sin barras ni ".." al principio.
const ID_VALIDO = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
// Convención de la shell para "comando no encontrado".
const CODIGO_NO_ENCONTRADO = 127;
// El límite por defecto de spawnSync (1 MB) mata a los comandos habladores.
const MAX_BUFFER = 64 * 1024 * 1024;

const quitarSaltoFinal = (texto) => texto.replace(/\r?\n$/, '');

export function ultimasLineas(texto, max = MAX_LINEAS_SALIDA) {
  const lineas = texto.split(/\r?\n/);
  if (lineas.at(-1) === '') lineas.pop();
  return lineas.slice(Math.max(lineas.length - max, 0)).join('\n');
}

function problemaDeUso({ positionals, out, comando }) {
  if (positionals.length === 0) return 'falta el id del check';
  if (positionals.length > 1) return 'solo se admite un id';
  if (!ID_VALIDO.test(positionals[0])) return `id no válido: «${positionals[0]}»`;
  if (!out) return 'falta --out <directorio>';
  if (comando.length === 0) return 'falta el comando tras --';
  return null;
}

export function parsearArgumentos(argv) {
  const separador = argv.indexOf('--');
  if (separador === -1) throw new Error('falta el separador -- antes del comando');
  const { values, positionals } = parseArgs({
    args: argv.slice(0, separador),
    options: { out: { type: 'string' } },
    allowPositionals: true,
  });
  const comando = argv.slice(separador + 1);
  const problema = problemaDeUso({ positionals, out: values.out, comando });
  if (problema) throw new Error(problema);
  return { id: positionals[0], out: values.out, comando };
}

export function ejecutarComando([comando, ...args]) {
  const inicio = performance.now();
  const resultado = spawnSync(comando, args, { encoding: 'utf8', maxBuffer: MAX_BUFFER });
  return {
    codigo: resultado.status,
    senal: resultado.signal,
    error: resultado.error,
    stdout: resultado.stdout ?? '',
    stderr: resultado.stderr ?? '',
    duracionMs: Math.round(performance.now() - inicio),
  };
}

export function construirInforme(id, { codigo, senal, error, stdout, stderr, duracionMs }) {
  if (error) {
    return {
      id,
      estado: 'FALLO',
      codigo: error.code === 'ENOENT' ? CODIGO_NO_ENCONTRADO : 1,
      duracionMs,
      salida: `No se pudo ejecutar el comando: ${error.message}`,
    };
  }
  // Sin código de salida es que lo mató una señal: nunca puede contar como OK.
  const codigoFinal = codigo ?? 1;
  const partes = [stdout, stderr].filter((texto) => texto !== '').map(quitarSaltoFinal);
  if (senal) partes.push(`El proceso terminó por la señal ${senal}`);
  return {
    id,
    estado: codigoFinal === 0 ? 'OK' : 'FALLO',
    codigo: codigoFinal,
    duracionMs,
    salida: ultimasLineas(partes.join('\n')),
  };
}

export function main(
  argv,
  { out = (texto) => process.stdout.write(texto), err = (texto) => process.stderr.write(texto) } = {},
) {
  let argumentos;
  try {
    argumentos = parsearArgumentos(argv);
  } catch (error) {
    err(`Error: ${error.message}\n${USO}\n`);
    return 2;
  }
  const ejecucion = ejecutarComando(argumentos.comando);
  const informe = construirInforme(argumentos.id, ejecucion);
  escribirInforme(join(argumentos.out, `${informe.id}.json`), informe);
  // El comando va capturado para poder guardarlo; se reenvía para que el log del CI no pierda nada.
  out(ejecucion.stdout);
  err(ejecucion.stderr);
  // Si el comando acabó sin salto de línea, el aviso no se pega a su última línea.
  const salto = ejecucion.stdout === '' || ejecucion.stdout.endsWith('\n') ? '' : '\n';
  out(`${salto}${informe.estado} ${informe.id} (código ${informe.codigo}, ${informe.duracionMs} ms)\n`);
  return 0;
}

if (seEjecutaDirectamente(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
