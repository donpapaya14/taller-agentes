import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeEntorno } from '@/adaptadores/supabase/entorno';
import { PLAZO_TOTAL_MS } from '@/adaptadores/supabase/tiempo-limite';
import { USUARIOS_DEMO } from '@/aplicacion/acceso';
import { falloDeSupabase } from '../../../tests/apoyo/fallos-falsos';
import { entrar, entrarComoDemo, restablecer, salir } from './acciones';

const { cliente, crearClienteServidor, redirect, rpcRestablecer, reponerContrasenas } = vi.hoisted(
  () => ({
    cliente: { auth: { signInWithPassword: vi.fn(), signOut: vi.fn() } },
    crearClienteServidor: vi.fn(),
    redirect: vi.fn(),
    rpcRestablecer: vi.fn(),
    reponerContrasenas: vi.fn(),
  }),
);

// `server-only` lanza fuera de un componente de servidor de Next; aquí solo hay que dejarlo pasar.
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/adaptadores/supabase/cliente-servidor', () => ({ crearClienteServidor }));
vi.mock('@/adaptadores/supabase/demo', () => ({ rpcRestablecer, reponerContrasenas }));

const CORREO = 'jefe@tallerdemo.example';
const CONTRASENA = 'contraseña de prueba';
const CONTRASENA_DE_DEMO = 'contraseña de demostración de prueba';
const SIN_ESTADO = { error: null };
const AVISO_DE_DEMO = '/login?error=demo';

const INCORRECTAS = { error: 'Correo o contraseña incorrectos' };
const SIN_SERVICIO = {
  error: 'El servicio no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.',
};
const NO_VALIDOS = { error: 'Escribe un correo y una contraseña válidos' };

const formulario = (campos: Record<string, string | File>) => {
  const datos = new FormData();
  Object.entries(campos).forEach(([nombre, valor]) => datos.set(nombre, valor));
  return datos;
};

const credenciales = (cambios: Record<string, string | File> = {}) =>
  formulario({ correo: CORREO, contrasena: CONTRASENA, ...cambios });

// Como el redirect de Next, el de la prueba interrumpe la acción: lo que sigue no se ejecuta.
const destinoDe = async (accion: Promise<unknown>): Promise<string> => {
  const resultado = await accion.then(
    () => new Error('La acción terminó sin redirigir'),
    (fallo: unknown) => fallo,
  );
  return resultado instanceof Error
    ? resultado.message.replace('REDIRIGE:', '')
    : String(resultado);
};

const rolDeDemo = (datos: FormData) => destinoDe(entrarComoDemo(datos));

beforeEach(() => {
  vi.stubEnv('SUPABASE_SECRET_KEY', 'clave secreta de prueba');
  vi.stubEnv('CRON_SECRET', 'secreto del cron de prueba');
  vi.stubEnv('DEMO_PASSWORD', CONTRASENA_DE_DEMO);
  crearClienteServidor.mockResolvedValue(cliente);
  cliente.auth.signInWithPassword.mockResolvedValue({ error: null });
  cliente.auth.signOut.mockResolvedValue({ error: null });
  reponerContrasenas.mockResolvedValue(undefined);
  redirect.mockImplementation((destino: string) => {
    throw new Error(`REDIRIGE:${destino}`);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe('entrar', () => {
  it('[C-1] con sus credenciales entra y va al tablero', async () => {
    expect(await destinoDe(entrar(SIN_ESTADO, credenciales()))).toBe('/tablero');
    expect(cliente.auth.signInWithPassword).toHaveBeenCalledWith({
      email: CORREO,
      password: CONTRASENA,
    });
  });

  it('[C-1] con credenciales rechazadas se queda en el login y lo explica', async () => {
    cliente.auth.signInWithPassword.mockResolvedValue({ error: { status: 400 } });

    expect(await entrar(SIN_ESTADO, credenciales())).toEqual(INCORRECTAS);
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([0, 429, 500, 503, undefined])(
    '[D-14] si Auth responde con el estado %s dice que el servicio no está disponible',
    async (status) => {
      cliente.auth.signInWithPassword.mockResolvedValue({ error: { status } });

      expect(await entrar(SIN_ESTADO, credenciales())).toEqual(SIN_SERVICIO);
    },
  );

  it('[D-14] un corte de red o de tiempo se cuenta como servicio caído', async () => {
    cliente.auth.signInWithPassword.mockRejectedValue(new TypeError('fetch failed'));

    expect(await entrar(SIN_ESTADO, credenciales())).toEqual(SIN_SERVICIO);
  });

  it('[D-14] sin las variables de Supabase dice que el servicio no está disponible', async () => {
    crearClienteServidor.mockRejectedValue(new ErrorDeEntorno('Falta la variable SUPABASE_URL'));

    expect(await entrar(SIN_ESTADO, credenciales())).toEqual(SIN_SERVICIO);
  });

  it('[D-14] un fallo que no es de red ni de entorno no se esconde', async () => {
    cliente.auth.signInWithPassword.mockRejectedValue(new Error('fallo inesperado'));

    await expect(entrar(SIN_ESTADO, credenciales())).rejects.toThrow('fallo inesperado');
  });
});

const BASURA: [string, FormData][] = [
  ['sin campos', formulario({})],
  ['sin contraseña', formulario({ correo: CORREO })],
  ['sin correo', formulario({ contrasena: CONTRASENA })],
  ['correo que no es un correo', credenciales({ correo: 'no es un correo' })],
  ['contraseña vacía', credenciales({ contrasena: '' })],
  ['correo larguísimo', credenciales({ correo: `${'a'.repeat(300)}@x.example` })],
  ['contraseña larguísima', credenciales({ contrasena: 'x'.repeat(10_000) })],
  ['un archivo en vez de texto', credenciales({ correo: new File(['a'], 'a.txt') })],
];

describe('entrar: entrada basura', () => {
  it.each(BASURA)('[D-2] %s no llega a Supabase', async (_caso, datos) => {
    expect(await entrar(SIN_ESTADO, datos)).toEqual(NO_VALIDOS);
    expect(crearClienteServidor).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('[D-2] los espacios de los bordes del correo se recortan', async () => {
    await destinoDe(entrar(SIN_ESTADO, credenciales({ correo: `  ${CORREO} ` })));

    expect(cliente.auth.signInWithPassword).toHaveBeenCalledWith({
      email: CORREO,
      password: CONTRASENA,
    });
  });
});

describe('entrarComoDemo', () => {
  it.each(['jefe', 'mecanico'] as const)(
    '[C-1] %s entra con su usuario de demostración y la contraseña del servidor',
    async (rol) => {
      expect(await rolDeDemo(formulario({ rol }))).toBe('/tablero');
      expect(cliente.auth.signInWithPassword).toHaveBeenCalledWith({
        email: USUARIOS_DEMO[rol],
        password: CONTRASENA_DE_DEMO,
      });
    },
  );

  it.each([['otro'], ['admin'], ['JEFE'], ['']])(
    '[D-2] el rol «%s» no es de demostración: vuelve al login sin llamar a Supabase',
    async (rol) => {
      expect(await rolDeDemo(formulario({ rol }))).toBe(AVISO_DE_DEMO);
      expect(cliente.auth.signInWithPassword).not.toHaveBeenCalled();
    },
  );

  it('[D-2] sin rol vuelve al login sin llamar a Supabase', async () => {
    expect(await rolDeDemo(formulario({}))).toBe(AVISO_DE_DEMO);
    expect(cliente.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('entrarComoDemo: cuando algo falla', () => {
  it.each([{ status: 400 }, { status: 500 }, { status: undefined }])(
    '[D-14] si Auth responde con %o vuelve al login con el aviso',
    async (error) => {
      cliente.auth.signInWithPassword.mockResolvedValue({ error });

      expect(await rolDeDemo(formulario({ rol: 'jefe' }))).toBe(AVISO_DE_DEMO);
    },
  );

  it('[D-14] sin la contraseña de demostración en el entorno vuelve al login con el aviso', async () => {
    vi.stubEnv('DEMO_PASSWORD', '');

    expect(await rolDeDemo(formulario({ rol: 'jefe' }))).toBe(AVISO_DE_DEMO);
    expect(cliente.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('[D-4] la contraseña de demostración no sale en ninguna redirección', async () => {
    cliente.auth.signInWithPassword.mockResolvedValue({ error: { status: 400 } });

    const destinos = [
      await rolDeDemo(formulario({ rol: 'jefe' })),
      await rolDeDemo(formulario({ rol: 'x' })),
    ];

    expect(destinos.filter((destino) => destino.includes(CONTRASENA_DE_DEMO))).toEqual([]);
  });
});

// Quien pulsa «Restablecer la demo» no ha entrado: la respuesta le dice qué pasó, pero nunca qué
// variable falta ni qué dijo la base de datos.
describe('restablecer', () => {
  it('[C-13] con la base restablecida repone las contraseñas y dice que ya puede entrar', async () => {
    rpcRestablecer.mockResolvedValue('RESTABLECIDO');

    expect(await restablecer()).toEqual({
      tipo: 'ok',
      texto: 'Demo restablecida. Ya puedes entrar',
    });
    expect(reponerContrasenas).toHaveBeenCalledWith(
      Object.values(USUARIOS_DEMO),
      expect.any(AbortSignal),
    );
  });

  it('[C-13] con un restablecimiento reciente dice que pruebe a entrar y no repone las contraseñas', async () => {
    rpcRestablecer.mockResolvedValue('EN_ESPERA');

    expect(await restablecer()).toEqual({
      tipo: 'ok',
      texto: 'La demo se restableció hace menos de 10 minutos. Prueba a entrar',
    });
    // Cualquiera puede pulsar el enlace: reponer las contraseñas son llamadas de administración a
    // Auth, y con la espera de 10 minutos solo las hace el cron.
    expect(reponerContrasenas).not.toHaveBeenCalled();
  });
});

describe('restablecer: cuando algo falla', () => {
  const MOTIVO = 'No se pudo restablecer la demo';

  it.each([
    [
      'la base de datos falla con un error con código',
      () => rpcRestablecer.mockRejectedValue(falloDeSupabase('connection refused', '08006')),
    ],
    [
      'no se pueden reponer las contraseñas',
      () => {
        rpcRestablecer.mockResolvedValue('RESTABLECIDO');
        reponerContrasenas.mockRejectedValue(falloDeSupabase('Auth caído', 'unexpected_failure'));
      },
    ],
  ])('[C-13][D-14] si %s, dice el motivo sin el detalle', async (_caso, preparar) => {
    preparar();

    expect(await restablecer()).toEqual({ tipo: 'error', texto: MOTIVO });
  });

  // Lo que la aplicación no sabe contar no se disfraza de «No se pudo restablecer la demo»: se relanza,
  // y en producción Next no cuenta al navegador ni qué variable falta ni qué dijo la base de datos.
  it.each([
    ['faltan las variables de entorno', new ErrorDeEntorno('Falta SUPABASE_SECRET_KEY')],
    ['la base falla sin ningún código', new Error('connection refused')],
  ])('[C-13][D-14] si %s, el fallo se relanza', async (_caso, error) => {
    rpcRestablecer.mockRejectedValue(error);

    await expect(restablecer()).rejects.toBe(error);
  });

  it('[C-13][D-14] si Supabase no contesta a tiempo, lo dice y no se queda esperando', async () => {
    vi.useFakeTimers();
    rpcRestablecer.mockReturnValue(new Promise(() => undefined));

    const resultado = restablecer();
    await vi.advanceTimersByTimeAsync(PLAZO_TOTAL_MS);

    expect(await resultado).toEqual({
      tipo: 'error',
      texto: 'La base de datos no contestó a tiempo',
    });
    expect(reponerContrasenas).not.toHaveBeenCalled();
  });
});

describe('salir', () => {
  it('[C-1] cierra solo la sesión de este navegador y vuelve al login', async () => {
    expect(await destinoDe(salir())).toBe('/login');
    // Los usuarios de demostración los comparten varias personas: un cierre global echaría al resto.
    expect(cliente.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('módulo de acciones', () => {
  it('[D-4] es un módulo de servidor: la contraseña de demostración no llega al navegador', () => {
    const texto = readFileSync(join(import.meta.dirname, 'acciones.ts'), 'utf8');

    expect(texto.split('\n')[0]).toBe("'use server';");
  });
});
