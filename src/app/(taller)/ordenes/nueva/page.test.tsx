import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listarVehiculos } from '@/adaptadores/supabase/ordenes';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import { FILA_VEHICULO } from '../../../../../tests/apoyo/filas-de-ejemplo';
import { navegarLanzando, SESION_MECANICO } from '../../../../../tests/apoyo/next-falso';
import { crearOrdenAccion } from './acciones';
import PaginaDeNuevaOrden, { metadata } from './page';

vi.mock('@/adaptadores/supabase/sesion', () => ({ leerSesion: vi.fn() }));
vi.mock('@/adaptadores/supabase/ordenes', () => ({ listarVehiculos: vi.fn() }));
vi.mock('./acciones', () => ({ crearOrdenAccion: vi.fn() }));

const VEHICULOS = [
  { id: FILA_VEHICULO.id, matricula: '1234BCD', etiqueta: 'Seat Ibiza' },
  { id: '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7b64', matricula: '5678FGH', etiqueta: '' },
];

beforeEach(() => {
  vi.mocked(leerSesion).mockResolvedValue(SESION_MECANICO);
  vi.mocked(listarVehiculos).mockResolvedValue(VEHICULOS);
  vi.mocked(crearOrdenAccion).mockResolvedValue({ errores: {}, motivo: null, valores: {} });
  navegarLanzando();
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const dibujar = async () => render(await PaginaDeNuevaOrden());

describe('/ordenes/nueva', () => {
  it('[C-1] sin sesión redirige a /login y no pide ningún dato', async () => {
    vi.mocked(leerSesion).mockResolvedValue(null);

    await expect(PaginaDeNuevaOrden()).rejects.toThrow('REDIRIGE:/login');

    expect(listarVehiculos).not.toHaveBeenCalled();
  });

  it('[C-1] un fallo al leer la sesión no se confunde con «sin sesión»', async () => {
    vi.mocked(leerSesion).mockRejectedValue(new Error('No se pudo cargar tu taller.'));

    await expect(PaginaDeNuevaOrden()).rejects.toThrow('No se pudo cargar tu taller.');
  });

  it('[C-15] si falla la lectura de vehículos el fallo sube a la pantalla de error del taller', async () => {
    vi.mocked(listarVehiculos).mockRejectedValue(
      new Error('No se pudieron cargar los vehículos. Inténtalo de nuevo en unos minutos.'),
    );

    await expect(PaginaDeNuevaOrden()).rejects.toThrow('No se pudieron cargar los vehículos.');
  });

  it('[C-11] titula la pantalla y ofrece los vehículos del taller más «Vehículo nuevo»', async () => {
    await dibujar();

    const opciones = within(screen.getByLabelText('Vehículo')).getAllByRole('option');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Nueva orden');
    expect(opciones.map((opcion) => opcion.textContent)).toEqual([
      'Elige un vehículo',
      '1234BCD · Seat Ibiza',
      '5678FGH',
      'Vehículo nuevo',
    ]);
  });

  it('[C-11] el formulario envía a la acción de crear la orden lo que se escribió', async () => {
    await dibujar();

    fireEvent.change(screen.getByLabelText('Vehículo'), { target: { value: FILA_VEHICULO.id } });
    fireEvent.change(screen.getByLabelText('Qué hay que hacer'), {
      target: { value: 'Cambio de aceite' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear orden' }));

    await waitFor(() => expect(crearOrdenAccion).toHaveBeenCalledTimes(1));
    const datos = vi.mocked(crearOrdenAccion).mock.calls[0][1];
    expect([datos.get('vehiculoId'), datos.get('descripcion')]).toEqual([
      FILA_VEHICULO.id,
      'Cambio de aceite',
    ]);
  });

  it('la pestaña del navegador lleva el título de la pantalla', () => {
    expect(metadata.title).toBe('Nueva orden · FOSO');
  });
});
