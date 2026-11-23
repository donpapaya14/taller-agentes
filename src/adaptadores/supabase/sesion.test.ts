import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { leerSesion, refrescarSesion } from './sesion';
import { PLAZO_TOTAL_MS, PlazoVencido } from './tiempo-limite';

const { crearClienteServidor, createServerClient } = vi.hoisted(() => ({
  crearClienteServidor: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock('./cliente-servidor', () => ({ crearClienteServidor }));
vi.mock('@supabase/ssr', () => ({ createServerClient }));

const ID_USUARIO = '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7b64';
const ID_TALLER = '9c1e7d52-0b3a-4f68-8a2d-6e4b1c7f3a90';

const FILA = {
  taller_id: ID_TALLER,
  rol: 'jefe',
  nombre: 'Marta',
  talleres: { nombre: 'Taller Demo' },
};

const FILAS_BASURA: Record<string, unknown> = {
  'un texto': 'texto',
  'un número': 42,
  'una lista': [FILA],
  'un objeto vacío': {},
  'un rol que no existe': { ...FILA, rol: 'dueño' },
  'el taller vacío': { ...FILA, taller_id: '' },
  'el nombre como número': { ...FILA, nombre: 123 },
  'el taller sin nombre': { ...FILA, talleres: {} },
  'el taller como lista': { ...FILA, talleres: [{ nombre: 'Taller Demo' }] },
};

const sinUsuario = {
  auth: { getUser: async () => ({ data: { user: null }, error: new Error('x') }) },
};

const FALLOS_DE_RED_O_TIEMPO: [string, Error][] = [
  [
    'un tiempo agotado',
    new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
  ],
  ['una petición abortada', new DOMException('This operation was aborted', 'AbortError')],
  ['un fallo de red', new TypeError('fetch failed')],
];
const OTRO_FALLO = new Error('el almacén de cookies se rompió');

const clienteQueLanza = (error: Error) => ({
  auth: {
    getUser: async () => {
      throw error;
    },
  },
});

// Lo que devuelve supabase-js de verdad cuando fetch falla: el fallo va en `error`, no se lanza.
const clienteConAuthCaido = {
  auth: {
    getUser: async () => ({
      data: { user: null },
      error: Object.assign(new Error('fetch failed'), { name: 'AuthRetryableFetchError' }),
    }),
  },
};

type RespuestaDeLaConsulta = { data: unknown; error: { message: string } | null };

// Una consulta de supabase-js: cada método devuelve la misma consulta y, al pedir la fila, da la
// respuesta.
function consultaQueDa(respuesta: RespuestaDeLaConsulta) {
  const consulta = {
    select: vi.fn(),
    eq: vi.fn(),
    retry: vi.fn(),
    maybeSingle: async () => respuesta,
  };
  consulta.select.mockReturnValue(consulta);
  consulta.eq.mockReturnValue(consulta);
  consulta.retry.mockReturnValue(consulta);
  return consulta;
}

function conUsuarioYRespuesta(respuesta: RespuestaDeLaConsulta) {
  const consulta = consultaQueDa(respuesta);
  const from = vi.fn(() => consulta);
  const getUser = async () => ({ data: { user: { id: ID_USUARIO } }, error: null });
  return { from, eq: consulta.eq, retry: consulta.retry, auth: { getUser } };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe('leerSesion', () => {
  it('sin usuario no hay sesión y no consulta a los miembros', async () => {
    crearClienteServidor.mockResolvedValue(sinUsuario);

    expect(await leerSesion()).toBeNull();
  });

  it('une al usuario con su fila de miembros y el nombre de su taller', async () => {
    const cliente = conUsuarioYRespuesta({ data: FILA, error: null });
    crearClienteServidor.mockResolvedValue(cliente);

    expect(await leerSesion()).toEqual({
      usuarioId: ID_USUARIO,
      tallerId: ID_TALLER,
      taller: 'Taller Demo',
      rol: 'jefe',
      nombre: 'Marta',
    });
    expect(cliente.from).toHaveBeenCalledWith('miembros');
    expect(cliente.eq).toHaveBeenCalledWith('usuario_id', ID_USUARIO);
  });

  it.each(Object.entries(FILAS_BASURA))('[D-2] rechaza una fila con %s', async (_, fila) => {
    crearClienteServidor.mockResolvedValue(conUsuarioYRespuesta({ data: fila, error: null }));

    await expect(leerSesion()).rejects.toThrow(
      'No se entienden los datos de tu taller. Vuelve a entrar o avisa al administrador.',
    );
  });

  it('un usuario que no está en ningún taller recibe un error que se entiende', async () => {
    crearClienteServidor.mockResolvedValue(conUsuarioYRespuesta({ data: null, error: null }));

    await expect(leerSesion()).rejects.toThrow('Tu cuenta no está asociada a ningún taller.');
  });

  it('si la consulta falla, el error no se traga y dice qué hacer', async () => {
    const error = { message: 'connection refused' };
    crearClienteServidor.mockResolvedValue(conUsuarioYRespuesta({ data: null, error }));

    await expect(leerSesion()).rejects.toThrow(
      'No se pudo cargar tu taller. Inténtalo de nuevo en unos minutos.',
    );
  });
});

describe('leerSesion con Supabase caído', () => {
  it('[D-14] el error de la consulta viaja como causa del mensaje', async () => {
    const error = { message: 'connection refused' };
    crearClienteServidor.mockResolvedValue(conUsuarioYRespuesta({ data: null, error }));

    await expect(leerSesion()).rejects.toMatchObject({
      message: 'No se pudo cargar tu taller. Inténtalo de nuevo en unos minutos.',
      cause: error,
    });
  });

  it('[D-14] la consulta de miembros no reintenta: con Supabase caído esperaría más que el plazo', async () => {
    const cliente = conUsuarioYRespuesta({ data: FILA, error: null });
    crearClienteServidor.mockResolvedValue(cliente);

    await leerSesion();

    expect(cliente.retry).toHaveBeenCalledWith(false);
  });

  it('[D-14] crea el cliente con la señal del plazo de la operación', async () => {
    crearClienteServidor.mockResolvedValue(sinUsuario);

    await leerSesion();

    expect(crearClienteServidor).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
});

describe('leerSesion sin respuesta de Auth', () => {
  it.each(FALLOS_DE_RED_O_TIEMPO)('[D-14] si Auth falla por %s no hay sesión', async (_, error) => {
    crearClienteServidor.mockResolvedValue(clienteQueLanza(error));

    expect(await leerSesion()).toBeNull();
  });

  it('[D-14] un error que no es de red ni de tiempo no se traga', async () => {
    crearClienteServidor.mockResolvedValue(clienteQueLanza(OTRO_FALLO));

    await expect(leerSesion()).rejects.toThrow(OTRO_FALLO.message);
  });

  it('[D-14] si Auth contesta con un fallo de red tampoco hay sesión', async () => {
    crearClienteServidor.mockResolvedValue(clienteConAuthCaido);

    expect(await leerSesion()).toBeNull();
  });

  it('[D-14] si la operación entera pasa del plazo avisa con el mensaje de siempre y guarda el motivo', async () => {
    vi.useFakeTimers();
    crearClienteServidor.mockResolvedValue({
      auth: { getUser: () => new Promise(() => undefined) },
    });

    const lectura = expect(leerSesion()).rejects.toMatchObject({
      message: 'No se pudo cargar tu taller. Inténtalo de nuevo en unos minutos.',
      cause: expect.any(PlazoVencido),
    });
    await vi.advanceTimersByTimeAsync(PLAZO_TOTAL_MS);

    await lectura;
  });
});

const peticion = () =>
  new NextRequest('http://localhost/tablero', { headers: { cookie: 'sb-sesion=abc' } });
const manejadoresDeCookies = () => createServerClient.mock.calls[0][2].cookies;
const clienteConUsuario = (user: unknown) => ({
  auth: { getUser: async () => ({ data: { user }, error: null }) },
});

describe('refrescarSesion', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://proyecto.example');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'clave-publicable');
  });

  it('crea el cliente con la URL y la clave publicable y le da las cookies de la petición', async () => {
    createServerClient.mockReturnValue(clienteConUsuario(null));

    await refrescarSesion(peticion());

    expect(createServerClient.mock.calls[0].slice(0, 2)).toEqual([
      'https://proyecto.example',
      'clave-publicable',
    ]);
    expect(manejadoresDeCookies().getAll()).toEqual([{ name: 'sb-sesion', value: 'abc' }]);
  });

  it('hay sesión solo si Supabase reconoce al usuario', async () => {
    createServerClient.mockReturnValueOnce(clienteConUsuario({ id: ID_USUARIO }));
    createServerClient.mockReturnValueOnce(clienteConUsuario(null));

    const conUsuario = await refrescarSesion(peticion());
    const sinNadie = await refrescarSesion(peticion());

    expect([conUsuario.haySesion, sinNadie.haySesion]).toEqual([true, false]);
  });

  it('recoge las cookies y cabeceras que Supabase pide escribir y las deja en la petición', async () => {
    const renovada = { name: 'sb-sesion', value: 'nueva', options: { path: '/' } };
    createServerClient.mockImplementation((_url, _clave, opciones) => ({
      auth: {
        getUser: async () => {
          opciones.cookies.setAll([renovada], { 'Cache-Control': 'private, no-store' });
          return { data: { user: { id: ID_USUARIO } }, error: null };
        },
      },
    }));
    const entrante = peticion();

    const resultado = await refrescarSesion(entrante);

    expect(resultado).toEqual({
      haySesion: true,
      cookies: [renovada],
      cabeceras: { 'Cache-Control': 'private, no-store' },
    });
    expect(entrante.cookies.get('sb-sesion')?.value).toBe('nueva');
  });

  it('[D-2] sin la clave publicable no consulta nada y dice qué variable falta', async () => {
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', '');

    await expect(refrescarSesion(peticion())).rejects.toThrow(
      'Falta la variable de entorno SUPABASE_PUBLISHABLE_KEY',
    );
    expect(createServerClient).not.toHaveBeenCalled();
  });
});

describe('refrescarSesion sin respuesta de Auth', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://proyecto.example');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'clave-publicable');
  });

  it.each(FALLOS_DE_RED_O_TIEMPO)(
    '[D-14] si Auth falla por %s cuenta como sin sesión',
    async (_, error) => {
      createServerClient.mockReturnValue(clienteQueLanza(error));

      expect(await refrescarSesion(peticion())).toEqual({
        haySesion: false,
        cookies: [],
        cabeceras: {},
      });
    },
  );

  it('[D-14] un error que no es de red ni de tiempo no se traga', async () => {
    createServerClient.mockReturnValue(clienteQueLanza(OTRO_FALLO));

    await expect(refrescarSesion(peticion())).rejects.toThrow(OTRO_FALLO.message);
  });

  it('[D-14] si Auth contesta con un fallo de red tampoco hay sesión', async () => {
    createServerClient.mockReturnValue(clienteConAuthCaido);

    expect((await refrescarSesion(peticion())).haySesion).toBe(false);
  });
});

describe('refrescarSesion pasado el plazo', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://proyecto.example');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'clave-publicable');
  });

  it('[D-14] si Auth no acaba en el plazo cuenta como sin sesión pero conserva lo ya renovado', async () => {
    vi.useFakeTimers();
    const renovada = { name: 'sb-sesion', value: 'nueva', options: { path: '/' } };
    createServerClient.mockImplementation((_url, _clave, opciones) => ({
      auth: {
        getUser: () => {
          opciones.cookies.setAll([renovada], { 'Cache-Control': 'private, no-store' });
          return new Promise(() => undefined);
        },
      },
    }));

    const refresco = refrescarSesion(peticion());
    await vi.advanceTimersByTimeAsync(PLAZO_TOTAL_MS);

    expect(await refresco).toEqual({
      haySesion: false,
      cookies: [renovada],
      cabeceras: { 'Cache-Control': 'private, no-store' },
    });
  });

  it('[D-14] al vencer el plazo corta las llamadas que el cliente tenía en marcha', async () => {
    vi.useFakeTimers();
    const buscar = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', buscar);
    createServerClient.mockImplementation((_url, _clave, opciones) => ({
      auth: {
        getUser: async () => {
          await opciones.global.fetch('https://proyecto.example/auth/v1/user');
          return new Promise(() => undefined);
        },
      },
    }));

    const refresco = refrescarSesion(peticion());
    await vi.advanceTimersByTimeAsync(PLAZO_TOTAL_MS);
    await refresco;

    expect(buscar.mock.calls[0][1].signal.aborted).toBe(true);
  });
});
