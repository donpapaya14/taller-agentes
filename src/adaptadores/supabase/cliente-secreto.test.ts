import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchQueNuncaResuelve } from '../../../tests/apoyo/fetch-falso';
import { crearClienteSecreto } from './cliente-secreto';

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));

// `server-only` lanza fuera de un componente de servidor de Next; aquí solo hay que dejarlo pasar.
vi.mock('server-only', () => ({}));
vi.mock('@supabase/supabase-js', () => ({ createClient }));

const VARIABLES = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'CRON_SECRET',
  'DEMO_PASSWORD',
];

beforeEach(() => {
  VARIABLES.forEach((nombre) => vi.stubEnv(nombre, `valor de ${nombre}`));
  // La URL se valida: tiene que ser una de verdad.
  vi.stubEnv('SUPABASE_URL', 'https://proyecto.example');
  createClient.mockReturnValue({ marca: 'cliente secreto' });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

// El fetch que el cliente de Supabase usaría: el que se le pasó en `global.fetch` al crearlo.
const fetchDelCliente = (): typeof fetch => createClient.mock.calls[0][2].global.fetch;

describe('crearClienteSecreto', () => {
  it('crea el cliente con la clave secreta, sin guardar sesión y con un fetch con tiempo límite', () => {
    const cliente = crearClienteSecreto();

    expect(cliente).toEqual({ marca: 'cliente secreto' });
    expect(createClient).toHaveBeenCalledWith(
      'https://proyecto.example',
      'valor de SUPABASE_SECRET_KEY',
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: expect.any(Function) },
      },
    );
  });

  // Con Supabase caído, supabase-js reintenta unos 25 s: el cron no puede quedarse esperando.
  it('[D-14] cada llamada lleva una señal de tiempo límite aunque no haya plazo', async () => {
    const buscar = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', buscar);
    crearClienteSecreto();

    await fetchDelCliente()('https://proyecto.example/rest/v1/rpc/restablecer_demo');

    expect(buscar).toHaveBeenCalledWith('https://proyecto.example/rest/v1/rpc/restablecer_demo', {
      signal: expect.any(AbortSignal),
    });
  });

  it('[D-14] ninguna llamada sigue esperando una vez vencido el plazo de la operación', async () => {
    vi.stubGlobal('fetch', fetchQueNuncaResuelve);
    const plazo = new AbortController();
    crearClienteSecreto(plazo.signal);

    const llamada = fetchDelCliente()('https://proyecto.example/auth/v1/admin/users');
    plazo.abort(new Error('se acabó el plazo'));

    await expect(llamada).rejects.toThrow('se acabó el plazo');
  });

  it('[D-14] con el plazo ya vencido, la llamada ni empieza', async () => {
    vi.stubGlobal('fetch', fetchQueNuncaResuelve);
    const plazo = new AbortController();
    plazo.abort(new Error('plazo vencido'));
    crearClienteSecreto(plazo.signal);

    await expect(fetchDelCliente()('https://proyecto.example/rest/v1/x')).rejects.toThrow(
      'plazo vencido',
    );
  });

  it('[D-2] sin la clave secreta no crea nada y dice qué variable falta', () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', '');

    expect(() => crearClienteSecreto()).toThrow('Falta la variable de entorno SUPABASE_SECRET_KEY');
    expect(createClient).not.toHaveBeenCalled();
  });
});
