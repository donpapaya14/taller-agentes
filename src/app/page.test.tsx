import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeEntorno } from '@/adaptadores/supabase/entorno';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import Inicio, { dynamic } from './page';

vi.mock('@/adaptadores/supabase/sesion', () => ({ leerSesion: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRIGE:${destino}`);
  }),
}));

const SESION = {
  usuarioId: 'u-1',
  tallerId: 't-1',
  taller: 'Taller Demo',
  rol: 'jefe',
  nombre: 'Marta Soler',
} as const;

beforeEach(() => {
  vi.mocked(leerSesion).mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const dibujarPortada = async () => render(await Inicio());

describe('portada', () => {
  it('[C-1] se pinta en cada petición: lo que enseña depende de quién entra', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('[C-1] sin sesión enseña el nombre, la frase y los dos enlaces', async () => {
    await dibujarPortada();

    expect(screen.getByRole('heading', { level: 1, name: 'FOSO' })).toBeTruthy();
    expect(
      screen.getByText(
        'Gestión de taller: órdenes, recambios y facturas. La construyeron tres agentes.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Entrar' }).getAttribute('href')).toBe('/login');
    expect(screen.getByRole('link', { name: 'Cómo se construyó' }).getAttribute('href')).toBe(
      '/proceso',
    );
  });

  it('[C-1] con sesión redirige al tablero', async () => {
    vi.mocked(leerSesion).mockResolvedValue(SESION);

    await expect(Inicio()).rejects.toThrow('REDIRIGE:/tablero');
  });

  it('[C-1] sin las variables de Supabase la portada se sirve igual: lo público sigue abierto', async () => {
    vi.mocked(leerSesion).mockRejectedValue(new ErrorDeEntorno('Falta la variable SUPABASE_URL'));

    await dibujarPortada();

    expect(screen.getByRole('heading', { level: 1, name: 'FOSO' })).toBeTruthy();
  });

  it('[D-14] un fallo de la sesión que no es de entorno no se esconde', async () => {
    vi.mocked(leerSesion).mockRejectedValue(
      new Error('Tu cuenta no está asociada a ningún taller.'),
    );

    await expect(Inicio()).rejects.toThrow('Tu cuenta no está asociada a ningún taller.');
  });

  it('[D-13] los dos enlaces son botones de al menos --toque de alto', async () => {
    await dibujarPortada();

    const altos = ['Entrar', 'Cómo se construyó'].map((nombre) =>
      [...screen.getByRole('link', { name: nombre }).classList].includes('min-h-toque'),
    );

    expect(altos).toEqual([true, true]);
  });
});
