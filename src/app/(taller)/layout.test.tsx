import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import { salir } from '../login/acciones';
import LayoutDelTaller, { dynamic } from './layout';

vi.mock('@/adaptadores/supabase/sesion', () => ({ leerSesion: vi.fn() }));
vi.mock('../login/acciones', () => ({ salir: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/tablero',
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRIGE:${destino}`);
  }),
}));

const SESION = {
  usuarioId: 'u-1',
  tallerId: 't-1',
  taller: 'Taller Demo',
  rol: 'mecanico',
  nombre: 'Andrés Molina',
} as const;

beforeEach(() => {
  vi.mocked(leerSesion).mockResolvedValue(SESION);
  vi.mocked(salir).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const contenido = <p>Contenido de la pantalla</p>;

describe('armazón del taller', () => {
  it('[C-1] se pinta en cada petición: depende de quién la pide y nunca queda hecho en el build', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('[C-1] sin sesión redirige a /login y no pinta nada: el proxy no es la barrera', async () => {
    vi.mocked(leerSesion).mockResolvedValue(null);

    await expect(LayoutDelTaller({ children: contenido })).rejects.toThrow('REDIRIGE:/login');
  });

  it('[C-1] un fallo al leer la sesión no se confunde con «sin sesión»', async () => {
    vi.mocked(leerSesion).mockRejectedValue(
      new Error('Tu cuenta no está asociada a ningún taller.'),
    );

    await expect(LayoutDelTaller({ children: contenido })).rejects.toThrow(
      'Tu cuenta no está asociada a ningún taller.',
    );
  });

  it('[C-1] con sesión pinta la navegación con los datos de la sesión y la pantalla debajo', async () => {
    render(await LayoutDelTaller({ children: contenido }));

    expect(screen.getByText('Taller Demo')).toBeTruthy();
    expect(screen.getByText('Andrés Molina')).toBeTruthy();
    expect(screen.getByText('Mecánico')).toBeTruthy();
    expect(screen.getByText('Contenido de la pantalla')).toBeTruthy();
  });

  it('[C-1] Salir ejecuta la acción de salir del login', async () => {
    render(await LayoutDelTaller({ children: contenido }));

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));

    await waitFor(() => expect(salir).toHaveBeenCalledTimes(1));
  });
});
