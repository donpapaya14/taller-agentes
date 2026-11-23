import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  createClient.mockReturnValue({ marca: 'cliente secreto' });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe('crearClienteSecreto', () => {
  it('crea el cliente con la clave secreta y sin guardar sesión', () => {
    const cliente = crearClienteSecreto();

    expect(cliente).toEqual({ marca: 'cliente secreto' });
    expect(createClient).toHaveBeenCalledWith(
      'valor de SUPABASE_URL',
      'valor de SUPABASE_SECRET_KEY',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  });

  it('[D-2] sin la clave secreta no crea nada y dice qué variable falta', () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', '');

    expect(() => crearClienteSecreto()).toThrow('Falta la variable de entorno SUPABASE_SECRET_KEY');
    expect(createClient).not.toHaveBeenCalled();
  });
});
