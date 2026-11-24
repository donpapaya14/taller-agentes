// Lo único que el checklist de entrega toca fuera de sí mismo: archivos del repo, comandos y
// peticiones web. Los tests de checklist-entrega.mjs lo sustituyen por uno falso.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const TIEMPO_MAXIMO_DEL_COMANDO_MS = 10 * 60 * 1000;
const TIEMPO_MAXIMO_DE_LA_PETICION_MS = 30 * 1000;
const MEMORIA_MAXIMA_DEL_COMANDO = 16 * 1024 * 1024;

export const sistemaReal = {
  existe: (ruta) => existsSync(resolve(RAIZ, ruta)),
  leer: (ruta) => readFileSync(resolve(RAIZ, ruta), 'utf8'),
  ejecutar(comando, argumentos) {
    const resultado = spawnSync(comando, argumentos, {
      cwd: RAIZ,
      encoding: 'utf8',
      timeout: TIEMPO_MAXIMO_DEL_COMANDO_MS,
      maxBuffer: MEMORIA_MAXIMA_DEL_COMANDO,
    });
    // Sin código (no existe el comando, o se pasó del tiempo) cuenta como fallo, no como éxito.
    const salida = [resultado.stdout, resultado.stderr, resultado.error?.message]
      .filter(Boolean)
      .join('\n');
    return { codigo: resultado.status ?? 1, salida };
  },
  // Sin seguir las redirecciones: la protección de Vercel responde con un 3xx o un 401, y seguirlo
  // llevaría a su página de acceso, que contesta 200 y daría un verde falso.
  async pedir(url) {
    const respuesta = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_DE_LA_PETICION_MS),
    });
    return { estado: respuesta.status, cuerpo: await respuesta.text() };
  },
};
