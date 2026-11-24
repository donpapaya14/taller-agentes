import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listarOrdenes } from '@/adaptadores/supabase/ordenes';
import { listarRecambios } from '@/adaptadores/supabase/recambios';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import { ORDEN_RESUMEN, RECAMBIO } from '../../../../tests/apoyo/filas-de-ejemplo';
import {
  navegarLanzando,
  SESION_JEFE as JEFE,
  SESION_MECANICO as MECANICO,
} from '../../../../tests/apoyo/next-falso';
import { leerAviso } from '../aviso';
import { avanzarOrden } from './acciones';
import PaginaDelTablero, { metadata } from './page';

vi.mock('@/adaptadores/supabase/sesion', () => ({ leerSesion: vi.fn() }));
vi.mock('@/adaptadores/supabase/ordenes', () => ({ listarOrdenes: vi.fn() }));
vi.mock('@/adaptadores/supabase/recambios', () => ({ listarRecambios: vi.fn() }));
vi.mock('../aviso', () => ({ leerAviso: vi.fn() }));
vi.mock('./acciones', () => ({ avanzarOrden: vi.fn() }));

const bajoMinimo = (referencia: string) => ({ ...RECAMBIO, referencia, stock: 2, stockMinimo: 2 });

beforeEach(() => {
  vi.mocked(leerSesion).mockResolvedValue(JEFE);
  vi.mocked(listarOrdenes).mockResolvedValue([]);
  vi.mocked(listarRecambios).mockResolvedValue([]);
  vi.mocked(leerAviso).mockResolvedValue(null);
  navegarLanzando();
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const dibujar = async () => render(await PaginaDelTablero());

describe('/tablero: quién entra', () => {
  it('[C-1] sin sesión redirige a /login y no pide ningún dato', async () => {
    vi.mocked(leerSesion).mockResolvedValue(null);

    await expect(PaginaDelTablero()).rejects.toThrow('REDIRIGE:/login');

    expect(listarOrdenes).not.toHaveBeenCalled();
    expect(listarRecambios).not.toHaveBeenCalled();
  });

  it('[C-1] un fallo al leer la sesión no se confunde con «sin sesión»', async () => {
    vi.mocked(leerSesion).mockRejectedValue(new Error('No se pudo cargar tu taller.'));

    await expect(PaginaDelTablero()).rejects.toThrow('No se pudo cargar tu taller.');
  });

  it('[C-15] si falla la lectura de órdenes el fallo sube a la pantalla de error del taller', async () => {
    vi.mocked(listarOrdenes).mockRejectedValue(
      new Error('No se pudieron cargar las órdenes. Inténtalo de nuevo en unos minutos.'),
    );

    await expect(PaginaDelTablero()).rejects.toThrow('No se pudieron cargar las órdenes.');
  });
});

describe('/tablero: las órdenes', () => {
  it('[C-10] titula la pantalla y pone cada orden en la columna de su estado', async () => {
    vi.mocked(listarOrdenes).mockResolvedValue([
      { ...ORDEN_RESUMEN, id: 'orden-1', estado: 'recibido' },
      { ...ORDEN_RESUMEN, id: 'orden-2', estado: 'en_reparacion' },
      { ...ORDEN_RESUMEN, id: 'orden-3', estado: 'en_reparacion' },
    ]);

    await dibujar();

    const recuento = screen.getAllByRole('region').map((columna) => [
      within(columna).getByRole('heading', { level: 2 }).textContent,
      within(columna).queryAllByRole('article').length,
    ]);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tablero');
    expect(recuento).toEqual([
      ['Recibido', 1],
      ['En reparación', 2],
      ['Listo', 0],
      ['Entregado', 0],
    ]);
  });

  it('[C-10] cada tarjeta lleva la matrícula, el vehículo, el cliente y la avería de su orden', async () => {
    vi.mocked(listarOrdenes).mockResolvedValue([ORDEN_RESUMEN]);

    await dibujar();

    const tarjeta = screen.getByRole('article');
    expect(tarjeta.textContent).toContain('1234BCD');
    expect(tarjeta.textContent).toContain('Seat Ibiza');
    expect(tarjeta.textContent).toContain('Marta Ruiz');
    expect(tarjeta.textContent).toContain('Cambio de aceite');
    expect(within(tarjeta).getByRole('link', { name: /1234BCD/ }).getAttribute('href')).toBe(
      `/ordenes/${ORDEN_RESUMEN.id}`,
    );
  });

  it('[C-15][D-11] sin órdenes cada columna dice que está vacía', async () => {
    await dibujar();

    expect(screen.queryAllByRole('article')).toEqual([]);
    expect(screen.getByText('Nada recibido hoy')).toBeTruthy();
  });

  it('[C-10] el botón de avanzar de una tarjeta lanza la acción del tablero con su orden', async () => {
    vi.mocked(listarOrdenes).mockResolvedValue([{ ...ORDEN_RESUMEN, estado: 'recibido' }]);
    await dibujar();

    fireEvent.click(screen.getByRole('button', { name: 'Pasar a en reparación' }));

    await waitFor(() => expect(avanzarOrden).toHaveBeenCalledTimes(1));
    const datos = vi.mocked(avanzarOrden).mock.calls[0][0];
    expect([datos.get('id'), datos.get('de')]).toEqual([ORDEN_RESUMEN.id, 'recibido']);
  });
});

describe('/tablero: nueva orden', () => {
  it.each([
    ['jefe', JEFE],
    ['mecánico', MECANICO],
  ])('[C-11] el %s tiene «Nueva orden», que lleva al formulario', async (_rol, sesion) => {
    vi.mocked(leerSesion).mockResolvedValue(sesion);

    await dibujar();

    const enlace = screen.getByRole('link', { name: /Nueva orden/ });
    expect(enlace.getAttribute('href')).toBe('/ordenes/nueva');
    expect([...enlace.classList]).toEqual(expect.arrayContaining(['min-h-toque', 'bg-lampara']));
  });
});

describe('/tablero: entregar', () => {
  const LISTA = { ...ORDEN_RESUMEN, estado: 'listo' as const };

  it('[C-3] el jefe ve «Entregar» en las órdenes listas', async () => {
    vi.mocked(listarOrdenes).mockResolvedValue([LISTA]);

    await dibujar();

    expect(screen.getByRole('link', { name: 'Entregar' }).getAttribute('href')).toBe(
      `/ordenes/${LISTA.id}`,
    );
  });

  it('[C-3] el mecánico no ve «Entregar»', async () => {
    vi.mocked(leerSesion).mockResolvedValue(MECANICO);
    vi.mocked(listarOrdenes).mockResolvedValue([LISTA]);

    await dibujar();

    expect(screen.queryByRole('link', { name: 'Entregar' })).toBeNull();
  });
});

describe('/tablero: recambios bajo mínimo', () => {
  const aviso = () => screen.queryByRole('link', { name: /bajo mínimo/ });

  it('[C-6] el jefe ve cuántos hay, con un enlace al almacén', async () => {
    vi.mocked(listarRecambios).mockResolvedValue([
      bajoMinimo('A-1'),
      RECAMBIO,
      bajoMinimo('A-2'),
      { ...RECAMBIO, referencia: 'A-3', stock: 0 },
    ]);

    await dibujar();

    expect(aviso()?.textContent).toBe('3 recambios bajo mínimo');
    expect(aviso()?.getAttribute('href')).toBe('/recambios');
  });

  it('[C-6] con un solo recambio el texto va en singular', async () => {
    vi.mocked(listarRecambios).mockResolvedValue([bajoMinimo('A-1'), RECAMBIO]);

    await dibujar();

    expect(aviso()?.textContent).toBe('1 recambio bajo mínimo');
  });

  it('[C-6] un recambio con el stock justo en su mínimo cuenta como bajo mínimo', async () => {
    vi.mocked(listarRecambios).mockResolvedValue([{ ...RECAMBIO, stock: 2, stockMinimo: 2 }]);

    await dibujar();

    expect(aviso()?.textContent).toBe('1 recambio bajo mínimo');
  });

  it('[C-6] con todo por encima de su mínimo no hay aviso', async () => {
    vi.mocked(listarRecambios).mockResolvedValue([RECAMBIO]);

    await dibujar();

    expect(aviso()).toBeNull();
  });

  it('[C-3] el mecánico no ve el aviso y ni siquiera se le piden los recambios', async () => {
    vi.mocked(leerSesion).mockResolvedValue(MECANICO);
    vi.mocked(listarRecambios).mockResolvedValue([bajoMinimo('A-1')]);

    await dibujar();

    expect(aviso()).toBeNull();
    expect(listarRecambios).not.toHaveBeenCalled();
  });

  it('[C-15] si falla la lectura de recambios el fallo sube a la pantalla de error del taller', async () => {
    vi.mocked(listarRecambios).mockRejectedValue(
      new Error('No se pudieron cargar los recambios. Inténtalo de nuevo en unos minutos.'),
    );

    await expect(PaginaDelTablero()).rejects.toThrow('No se pudieron cargar los recambios.');
  });
});

describe('/tablero: el aviso de la última acción', () => {
  it('[D-14] el motivo de una acción que no fue bien sale encima del tablero', async () => {
    vi.mocked(leerAviso).mockResolvedValue({
      tipo: 'error',
      texto: 'Otra persona ya movió esta orden. Recarga el tablero',
    });

    await dibujar();

    expect(screen.getByRole('alert').textContent).toBe(
      'Otra persona ya movió esta orden. Recarga el tablero',
    );
  });

  it('[D-14] sin aviso pendiente no hay alerta', async () => {
    await dibujar();

    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('/tablero: la pestaña', () => {
  it('la pestaña del navegador lleva el título de la pantalla', () => {
    expect(metadata.title).toBe('Tablero · FOSO');
  });
});
