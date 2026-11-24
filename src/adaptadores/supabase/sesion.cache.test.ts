import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { leerSesion } from './sesion';

const { crearClienteServidor, getUser, peticion } = vi.hoisted(() => ({
  crearClienteServidor: vi.fn(),
  getUser: vi.fn(),
  peticion: { enCurso: false },
}));

vi.mock('./cliente-servidor', () => ({ crearClienteServidor }));
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn() }));
// Dentro de una petición de Next, `cache` le da a quien repite la llamada lo que dio la primera vez;
// fuera de ella no guarda nada. `peticion.enCurso` enciende y apaga lo primero.
vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>();
  return {
    ...original,
    cache: <T>(funcion: () => T) => {
      const sinMemoria = original.cache(funcion);
      const memoria: T[] = [];
      return () => {
        if (!peticion.enCurso) return sinMemoria();
        if (memoria.length === 0) memoria.push(sinMemoria());
        return memoria[0];
      };
    },
  };
});

beforeEach(() => {
  // Sin usuario basta: lo que se cuenta es cuántas veces se le pregunta a Auth.
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  crearClienteServidor.mockResolvedValue({ auth: { getUser } });
});

afterEach(() => vi.resetAllMocks());

describe('leerSesion: una lectura por petición', () => {
  it('[D-14] dentro de una petición el layout y la página comparten una sola lectura de Auth', async () => {
    peticion.enCurso = true;

    const delLayout = leerSesion();
    const deLaPagina = leerSesion();
    await delLayout;

    expect(deLaPagina).toBe(delLayout);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('[D-14] fuera de una petición cada lectura pregunta a Auth: no se guarda nada entre peticiones', async () => {
    peticion.enCurso = false;

    await leerSesion();
    await leerSesion();

    expect(getUser).toHaveBeenCalledTimes(2);
  });
});
