import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { leerEntornoSecreto } from '@/adaptadores/supabase/entorno-secreto';
import { USUARIOS_DEMO } from '@/aplicacion/acceso';
import { type Contestar, iniciarServidorFalso, responderJson } from './supabase-falso';

// `server-only` lanza fuera de un componente de servidor de Next; aquí solo hay que dejarlo pasar.
vi.mock('server-only', () => ({}));

const ejecutar = promisify(execFile);
const raiz = resolve(import.meta.dirname, '../..');

// Lo único que el script le pide a Supabase: dar de alta a los usuarios y restablecer la demo.
const contestar: Contestar = (peticion, respuesta) => {
  if (peticion.ruta === '/auth/v1/admin/users') {
    responderJson(respuesta, 200, { id: 'usuario-de-prueba' });
  } else if (peticion.ruta === '/rest/v1/rpc/restablecer_demo') {
    // Lo que devuelve la función real: el script da por fallo cualquier otro valor.
    responderJson(respuesta, 200, 'RESTABLECIDO');
  } else {
    responderJson(respuesta, 404, { message: 'ruta desconocida' });
  }
};

let servidor: Awaited<ReturnType<typeof iniciarServidorFalso>>;

beforeEach(async () => {
  servidor = await iniciarServidorFalso(contestar);
});

afterEach(async () => {
  await servidor.cerrar();
});

const correrElScript = (demoPassword: string) =>
  ejecutar(process.execPath, ['scripts/crear-usuarios-demo.mjs'], {
    cwd: raiz,
    env: {
      ...process.env,
      SUPABASE_URL: servidor.url,
      SUPABASE_SECRET_KEY: 'clave-secreta',
      DEMO_PASSWORD: demoPassword,
    },
  });

const contrasenasEnviadas = () =>
  servidor.peticiones
    .filter((peticion) => peticion.ruta === '/auth/v1/admin/users')
    .map((peticion) => (JSON.parse(peticion.cuerpo) as { password: string }).password);

describe('scripts/crear-usuarios-demo.mjs', () => {
  // Con la contraseña copiada y pegada de otro sitio, la app y el script tienen que quedar de acuerdo.
  it.each(['  foso-taller-2026-demo \n', '\tdos palabras con espacios dentro  '])(
    '[D-2] da a los usuarios la misma contraseña que lee la app (%j)',
    async (copiada) => {
      const { demoPassword } = leerEntornoSecreto({
        SUPABASE_SECRET_KEY: 'clave-secreta',
        CRON_SECRET: 'secreto-del-cron',
        DEMO_PASSWORD: copiada,
      });

      await correrElScript(copiada);

      expect(contrasenasEnviadas()).toEqual(Object.values(USUARIOS_DEMO).map(() => demoPassword));
      expect(demoPassword).toBe(copiada.trim());
    },
  );

  it('[D-2] una contraseña solo con espacios cuenta como ausente: sale con 1 y no llama a Supabase', async () => {
    await expect(correrElScript('   ')).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Falta la variable de entorno DEMO_PASSWORD'),
    });
    expect(servidor.peticiones).toEqual([]);
  });
});
