import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { leerSesion, refrescarSesion } from './sesion';

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

function conUsuarioYRespuesta(respuesta: { data: unknown; error: { message: string } | null }) {
  const eq = vi.fn(() => ({ maybeSingle: async () => respuesta }));
  const from = vi.fn(() => ({ select: () => ({ eq }) }));
  const getUser = async () => ({ data: { user: { id: ID_USUARIO } }, error: null });
  return { from, eq, auth: { getUser } };
}

afterEach(() => {
  vi.unstubAllEnvs();
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
