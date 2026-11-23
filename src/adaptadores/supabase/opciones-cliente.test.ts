import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearClienteServidor } from './cliente-servidor';
import { opcionesDeCliente } from './opciones-cliente';
import { refrescarSesion } from './sesion';

const { createServerClient } = vi.hoisted(() => ({ createServerClient: vi.fn() }));

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: vi.fn(), set: vi.fn() }) }));
vi.mock('@supabase/ssr', () => ({ createServerClient }));

const clienteSinUsuario = {
  auth: { getUser: async () => ({ data: { user: null }, error: null }) },
};

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://proyecto.example');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'clave-publicable');
  createServerClient.mockReturnValue(clienteSinUsuario);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe('opcionesDeCliente', () => {
  it('[D-4] la cookie de sesión no la lee el JavaScript del navegador y no viaja entre sitios', () => {
    const { cookieOptions } = opcionesDeCliente();

    expect(cookieOptions.httpOnly).toBe(true);
    expect(cookieOptions.sameSite).toBe('lax');
  });

  it('[D-4] la cookie de sesión solo exige https en producción', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const enProduccion = opcionesDeCliente().cookieOptions.secure;
    vi.stubEnv('NODE_ENV', 'development');
    const enDesarrollo = opcionesDeCliente().cookieOptions.secure;
    vi.stubEnv('NODE_ENV', 'test');
    const enPruebas = opcionesDeCliente().cookieOptions.secure;

    expect([enProduccion, enDesarrollo, enPruebas]).toEqual([true, false, false]);
  });

  it('[D-14] las llamadas a Supabase llevan tiempo límite', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', buscar);

    await opcionesDeCliente().global.fetch('https://proyecto.example/auth/v1/user');

    expect(buscar).toHaveBeenCalledWith('https://proyecto.example/auth/v1/user', {
      signal: expect.any(AbortSignal),
    });
  });

  it('[D-14] las llamadas a Supabase se cortan al vencer el plazo de la operación', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', buscar);
    const plazo = new AbortController();

    await opcionesDeCliente(plazo.signal).global.fetch('https://proyecto.example/auth/v1/user');
    const { signal } = buscar.mock.calls[0][1];
    plazo.abort();

    expect(signal.aborted).toBe(true);
  });
});

// Los dos clientes de servidor: el de las páginas y el que refresca la sesión en el proxy.
const CLIENTES = [
  ['crearClienteServidor', () => crearClienteServidor()],
  ['refrescarSesion', () => refrescarSesion(new NextRequest('http://localhost/tablero'))],
] as const;

describe.each(CLIENTES)('el cliente de %s', (_, crear) => {
  it('[D-4] lleva la cookie de sesión httpOnly y sameSite lax, y segura solo en producción', async () => {
    await crear();
    vi.stubEnv('NODE_ENV', 'production');
    await crear();

    const [pruebas, produccion] = createServerClient.mock.calls.map(
      ([, , opciones]) => opciones.cookieOptions,
    );
    expect(pruebas).toEqual({ httpOnly: true, secure: false, sameSite: 'lax' });
    expect(produccion).toEqual({ httpOnly: true, secure: true, sameSite: 'lax' });
  });

  it('[D-14] hace sus llamadas a Supabase con tiempo límite', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', buscar);

    await crear();
    await createServerClient.mock.calls[0][2].global.fetch('https://proyecto.example/x');

    expect(buscar).toHaveBeenCalledWith('https://proyecto.example/x', {
      signal: expect.any(AbortSignal),
    });
  });
});
