import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearClienteServidor } from './cliente-servidor';

const { almacen, createServerClient } = vi.hoisted(() => ({
  almacen: { getAll: vi.fn(), set: vi.fn() },
  createServerClient: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: async () => almacen }));
vi.mock('@supabase/ssr', () => ({ createServerClient }));

const CLIENTE = { marca: 'cliente de servidor' };

const manejadoresDeCookies = () => createServerClient.mock.calls[0][2].cookies;

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://proyecto.example');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'clave-publicable');
  createServerClient.mockReturnValue(CLIENTE);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe('crearClienteServidor', () => {
  it('crea el cliente de Supabase con la URL y la clave publicable del entorno', async () => {
    const cliente = await crearClienteServidor();

    expect(cliente).toBe(CLIENTE);
    expect(createServerClient).toHaveBeenCalledWith(
      'https://proyecto.example',
      'clave-publicable',
      expect.objectContaining({ cookies: expect.any(Object) }),
    );
  });

  it('lee las cookies de la petición', async () => {
    almacen.getAll.mockReturnValue([{ name: 'sb-sesion', value: 'abc' }]);

    await crearClienteServidor();

    expect(manejadoresDeCookies().getAll()).toEqual([{ name: 'sb-sesion', value: 'abc' }]);
  });

  it('guarda cada cookie que el cliente pide escribir', async () => {
    await crearClienteServidor();

    manejadoresDeCookies().setAll(
      [
        { name: 'sb-sesion', value: 'abc', options: { path: '/', httpOnly: true } },
        { name: 'sb-otra', value: 'def', options: {} },
      ],
      {},
    );

    expect(almacen.set.mock.calls).toEqual([
      ['sb-sesion', 'abc', { path: '/', httpOnly: true }],
      ['sb-otra', 'def', {}],
    ]);
  });

  it('[D-14] las llamadas del cliente se cortan al vencer el plazo que recibe', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', buscar);
    const plazo = new AbortController();

    await crearClienteServidor(plazo.signal);
    await createServerClient.mock.calls[0][2].global.fetch('https://proyecto.example/x');
    const { signal } = buscar.mock.calls[0][1];
    plazo.abort();

    expect(signal.aborted).toBe(true);
  });

  it('[D-2] sin la URL no crea nada y dice qué variable falta', async () => {
    vi.stubEnv('SUPABASE_URL', '');

    await expect(crearClienteServidor()).rejects.toThrow(
      'Falta la variable de entorno SUPABASE_URL',
    );
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
