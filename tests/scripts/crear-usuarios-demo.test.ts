import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = resolve(import.meta.dirname, '../..');
const SCRIPT = resolve(raiz, 'scripts/crear-usuarios-demo.mjs');
const SEGUNDOS_PARA_ARRANCAR_NODE = 30;
// El servidor falso no mira ni la clave ni la contraseña: cualquier valor sirve.
const VALOR_DE_PRUEBA = 'valor-de-prueba';

type Salida = { codigo: number | null; lineas: string[]; errores: string };

// Un Supabase de mentira: Auth da por bueno cualquier alta y restablecer_demo responde lo que se le
// pida, que es lo que cambia de una prueba a otra.
function servidorFalso(resultadoDeRestablecer: string): Server {
  return createServer((peticion, respuesta) => {
    const esRestablecer = peticion.url?.startsWith('/rest/v1/rpc/restablecer_demo');
    const cuerpo = esRestablecer
      ? resultadoDeRestablecer
      : { id: '00000000-0000-4000-8000-000000000001' };
    respuesta.setHeader('Content-Type', 'application/json');
    respuesta.end(JSON.stringify(cuerpo));
  });
}

// El script se lanza como lo lanza quien lo usa, con un proceso de Node aparte, y se lee lo que
// escribe y con qué código sale. El entorno va entero a mano: no hereda las claves de nadie.
function lanzarScript(url: string): Promise<Salida> {
  return new Promise((terminado) => {
    const entorno: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      SUPABASE_URL: url,
      SUPABASE_SECRET_KEY: VALOR_DE_PRUEBA,
      DEMO_PASSWORD: VALOR_DE_PRUEBA,
    };
    const proceso = spawn(process.execPath, [SCRIPT], { cwd: raiz, env: entorno });
    let salida = '';
    let errores = '';
    proceso.stdout.on('data', (trozo: Buffer) => (salida += trozo.toString()));
    proceso.stderr.on('data', (trozo: Buffer) => (errores += trozo.toString()));
    proceso.on('close', (codigo) => {
      terminado({ codigo, lineas: salida.split('\n').filter(Boolean), errores });
    });
  });
}

async function ejecutarScript(resultadoDeRestablecer: string): Promise<Salida> {
  const servidor = servidorFalso(resultadoDeRestablecer);
  servidor.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  try {
    const { port } = servidor.address() as AddressInfo;
    return await lanzarScript(`http://127.0.0.1:${port}`);
  } finally {
    servidor.closeAllConnections();
    servidor.close();
  }
}

describe('scripts/crear-usuarios-demo.mjs', () => {
  it(
    '[D-14] si la demo ya se restableció hace poco, lo dice y no falla',
    async () => {
      const salida = await ejecutarScript('EN_ESPERA');

      expect(salida.codigo).toBe(0);
      expect(salida.lineas).toContain(
        'La demo ya se restableció hace menos de 10 minutos; los usuarios quedan creados.',
      );
      expect(salida.lineas).not.toContain('Demo restablecida.');
    },
    SEGUNDOS_PARA_ARRANCAR_NODE * 1000,
  );

  it(
    '[D-14] si restablece la demo, lo dice',
    async () => {
      const salida = await ejecutarScript('RESTABLECIDO');

      expect(salida.codigo).toBe(0);
      expect(salida.lineas).toContain('Demo restablecida.');
    },
    SEGUNDOS_PARA_ARRANCAR_NODE * 1000,
  );

  it(
    '[D-14] si restablecer_demo responde algo desconocido, falla y lo explica',
    async () => {
      const salida = await ejecutarScript('OTRA_COSA');

      expect(salida.codigo).toBe(1);
      expect(salida.errores).toContain('restablecer_demo devolvió un valor inesperado');
      expect(salida.lineas).not.toContain('Demo restablecida.');
    },
    SEGUNDOS_PARA_ARRANCAR_NODE * 1000,
  );
});
