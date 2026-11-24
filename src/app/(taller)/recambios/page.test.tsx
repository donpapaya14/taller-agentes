import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PaginaDeRecambios from './page';

const { guardar, leerSesion, listarRecambios, redirect } = vi.hoisted(() => ({
  guardar: vi.fn(),
  leerSesion: vi.fn(),
  listarRecambios: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/adaptadores/supabase/sesion', () => ({ leerSesion }));
vi.mock('@/adaptadores/supabase/recambios', () => ({ listarRecambios }));
vi.mock('./acciones', () => ({ guardar }));

const JEFE = { usuarioId: 'u-1', tallerId: 't-1', taller: 'Taller Demo', rol: 'jefe' };
const MECANICO = { ...JEFE, rol: 'mecanico' };

const recambio = (cambios: Record<string, unknown> = {}) => ({
  id: '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7b64',
  referencia: 'FIL-01',
  nombre: 'Filtro de aceite',
  precioCentimos: 123_456,
  stock: 5,
  stockMinimo: 2,
  ...cambios,
});

beforeEach(() => {
  leerSesion.mockResolvedValue(JEFE);
  listarRecambios.mockResolvedValue([recambio()]);
  redirect.mockImplementation((destino: string) => {
    throw new Error(`REDIRIGE:${destino}`);
  });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const dibujar = async () => render(await PaginaDeRecambios());

describe('pantalla de recambios: acceso', () => {
  it('[C-1] sin sesión redirige a /login y no pide ningún dato', async () => {
    leerSesion.mockResolvedValue(null);

    await expect(PaginaDeRecambios()).rejects.toThrow('REDIRIGE:/login');

    expect(listarRecambios).not.toHaveBeenCalled();
  });

  it('[D-11][D-14] si no se pueden leer los recambios, el fallo llega a la pantalla de error', async () => {
    listarRecambios.mockRejectedValue(new Error('No se pudieron cargar los recambios.'));

    await expect(PaginaDeRecambios()).rejects.toThrow('No se pudieron cargar los recambios.');
  });
});

describe('pantalla de recambios: lo que ve el jefe', () => {
  it('[C-6] se titula «Almacén» y cada recambio sale con su precio en euros', async () => {
    await dibujar();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Almacén');
    expect(within(screen.getByRole('article')).getByText('1.234,56 €')).toBeTruthy();
  });

  it('[C-3] tiene «Añadir recambio» y «Editar»', async () => {
    await dibujar();

    expect(screen.getByText('Añadir recambio')).toBeTruthy();
    expect(screen.getByText('Editar')).toBeTruthy();
  });

  it.each([
    ['por debajo del mínimo', 1, 2, true],
    ['justo en el mínimo', 2, 2, true],
    ['por encima del mínimo', 3, 2, false],
  ])(
    '[C-6] con el stock %s decide el núcleo si está bajo mínimo',
    async (_caso, stock, minimo, marcado) => {
      listarRecambios.mockResolvedValue([recambio({ stock, stockMinimo: minimo })]);

      await dibujar();

      expect(screen.queryAllByText('Bajo mínimo')).toHaveLength(marcado ? 1 : 0);
    },
  );

  it('[C-6] un recambio que baja del mínimo sube arriba, sea cual sea su referencia', async () => {
    listarRecambios.mockResolvedValue([
      recambio({ id: 'a', referencia: 'AAA-01', stock: 9 }),
      recambio({ id: 'b', referencia: 'ZZZ-99', stock: 0 }),
    ]);

    await dibujar();

    const [primera, segunda] = screen.getAllByRole('article');

    expect(primera.textContent).toContain('ZZZ-99');
    expect(segunda.textContent).toContain('AAA-01');
  });

  it('[C-3] guardar manda el formulario a la acción de guardar', async () => {
    guardar.mockResolvedValue({ ok: true });
    await dibujar();

    fireEvent.click(screen.getByRole('button', { name: /^Guardar cambios/ }));

    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    expect(guardar.mock.calls[0][1].get('stock')).toBe('5');
  });
});

describe('pantalla de recambios: lo que ve el mecánico', () => {
  beforeEach(() => {
    leerSesion.mockResolvedValue(MECANICO);
  });

  it('[C-3] no ve ningún precio', async () => {
    const { container } = await dibujar();

    expect(container.textContent).not.toContain('€');
    expect(container.textContent).toContain('Filtro de aceite');
  });

  it('[C-3] solo lee: ni formularios, ni «Editar», ni «Añadir recambio»', async () => {
    const { container } = await dibujar();

    expect(container.querySelectorAll('input, form, details')).toHaveLength(0);
    expect(screen.queryByText('Editar')).toBeNull();
    expect(screen.queryByText('Añadir recambio')).toBeNull();
  });
});

describe('pantalla de recambios: estado vacío', () => {
  it('[C-15][D-11] un almacén vacío lo dice', async () => {
    listarRecambios.mockResolvedValue([]);

    await dibujar();

    expect(screen.getByText('El almacén está vacío')).toBeTruthy();
  });

  it('[D-11] abre su propio <main>: el armazón solo pone la navegación', async () => {
    const { container } = await dibujar();

    expect(container.querySelectorAll('main')).toHaveLength(1);
  });
});
