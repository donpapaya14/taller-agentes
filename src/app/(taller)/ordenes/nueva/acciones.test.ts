import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearOrden, MatriculaRepetida } from '@/adaptadores/supabase/ordenes';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import type { EstadoFormulario } from '@/ui/ordenes/FormularioOrden';
import { ID_ORDEN } from '../../../../../tests/apoyo/filas-de-ejemplo';
import {
  formulario,
  redirect,
  navegarLanzando,
  revalidatePath,
  rolFalso,
  SESION_MECANICO,
} from '../../../../../tests/apoyo/next-falso';
import { crearOrdenAccion } from './acciones';

vi.mock('@/adaptadores/supabase/sesion', () => ({ leerSesion: vi.fn() }));
// La clase de error es la de verdad: la acción la reconoce con `instanceof`.
vi.mock('@/adaptadores/supabase/ordenes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/adaptadores/supabase/ordenes')>()),
  crearOrden: vi.fn(),
}));

const SESION = SESION_MECANICO;
const VEHICULO_ELEGIDO = '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7b64';
const ANTES: EstadoFormulario = { errores: {}, motivo: null, valores: {} };

const VEHICULO_NUEVO = {
  vehiculoId: '',
  matricula: '1234 bcd',
  marca: 'Seat',
  modelo: 'Ibiza',
  clienteNombre: 'Marta Ruiz',
  clienteTelefono: '612 345 678',
  descripcion: 'Cambio de aceite',
};

beforeEach(() => {
  vi.mocked(leerSesion).mockResolvedValue(SESION);
  vi.mocked(crearOrden).mockResolvedValue({ id: ID_ORDEN });
  navegarLanzando();
});

afterEach(() => vi.resetAllMocks());

describe('crearOrdenAccion: quién puede', () => {
  it('[C-1] sin sesión redirige a /login antes de tocar nada', async () => {
    vi.mocked(leerSesion).mockResolvedValue(null);

    await expect(crearOrdenAccion(ANTES, formulario(VEHICULO_NUEVO))).rejects.toThrow(
      'REDIRIGE:/login',
    );

    expect(crearOrden).not.toHaveBeenCalled();
  });

  it('[C-3] un rol que no puede crear órdenes no llega a la base de datos y lo oye', async () => {
    vi.mocked(leerSesion).mockResolvedValue({ ...SESION, rol: rolFalso('visitante') });

    const estado = await crearOrdenAccion(ANTES, formulario(VEHICULO_NUEVO));

    expect(estado).toEqual({
      errores: {},
      motivo: 'No tienes permiso para crear órdenes',
      valores: expect.objectContaining({ marca: 'Seat' }),
    });
    expect(crearOrden).not.toHaveBeenCalled();
  });
});

describe('crearOrdenAccion: crear la orden', () => {
  it('[C-11] con un vehículo del taller crea la orden en el taller de la sesión y abre su ficha', async () => {
    const campos = { vehiculoId: VEHICULO_ELEGIDO, descripcion: 'Cambio de aceite' };

    await expect(crearOrdenAccion(ANTES, formulario(campos))).rejects.toThrow(
      `REDIRIGE:/ordenes/${ID_ORDEN}`,
    );

    expect(crearOrden).toHaveBeenCalledExactlyOnceWith(
      { vehiculoId: VEHICULO_ELEGIDO, descripcion: 'Cambio de aceite' },
      't-1',
    );
  });

  it('[C-11] con un vehículo nuevo manda la matrícula y el teléfono ya normalizados', async () => {
    await expect(crearOrdenAccion(ANTES, formulario(VEHICULO_NUEVO))).rejects.toThrow('REDIRIGE:');

    expect(crearOrden).toHaveBeenCalledExactlyOnceWith(
      {
        matricula: '1234BCD',
        marca: 'Seat',
        modelo: 'Ibiza',
        clienteNombre: 'Marta Ruiz',
        clienteTelefono: '34612345678',
        descripcion: 'Cambio de aceite',
      },
      't-1',
    );
  });

  it('[C-11] el tablero se actualiza antes de abrir la ficha', async () => {
    await expect(crearOrdenAccion(ANTES, formulario(VEHICULO_NUEVO))).rejects.toThrow('REDIRIGE:');

    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/tablero');
    expect(revalidatePath.mock.invocationCallOrder[0]).toBeLessThan(
      redirect.mock.invocationCallOrder[0],
    );
  });
});

describe('crearOrdenAccion: errores junto a cada campo', () => {
  it('[C-11][D-2] cada error sale con el texto de su campo y no se crea nada', async () => {
    const campos = { ...VEHICULO_NUEVO, matricula: 'ab', clienteTelefono: '1', descripcion: 'a' };

    const estado = await crearOrdenAccion(ANTES, formulario(campos));

    expect(estado.errores).toEqual({
      matricula: 'Matrícula no válida. Ejemplo: 1234 BCD',
      clienteTelefono: 'Teléfono no válido. Nueve cifras, por ejemplo 612 345 678',
      descripcion: 'Describe la avería o el trabajo (entre 5 y 500 letras)',
    });
    expect(estado.motivo).toBeNull();
    expect(crearOrden).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('[C-11] devuelve lo escrito para que quien corrige no tenga que escribirlo todo otra vez', async () => {
    const campos = { ...VEHICULO_NUEVO, matricula: 'ab' };

    const estado = await crearOrdenAccion(ANTES, formulario(campos));

    expect(estado.valores).toEqual({
      matricula: 'ab',
      marca: 'Seat',
      modelo: 'Ibiza',
      clienteNombre: 'Marta Ruiz',
      clienteTelefono: '612 345 678',
      descripcion: 'Cambio de aceite',
    });
  });

  it('[C-11] sin elegir vehículo ni escribir nada pide elegir uno', async () => {
    const estado = await crearOrdenAccion(ANTES, formulario({ vehiculoId: '', descripcion: 'Cambio de aceite' }));

    expect(estado.errores).toEqual({ vehiculoId: 'Elige un vehículo' });
  });

  it('[D-2] lo que llega como archivo o no llega se trata como vacío, sin lanzar', async () => {
    const campos = { vehiculoId: new File(['x'], 'x.txt'), descripcion: new File(['y'], 'y.txt') };

    const estado = await crearOrdenAccion(ANTES, formulario(campos));

    expect(estado.errores).toEqual({
      vehiculoId: 'Elige un vehículo',
      descripcion: 'Describe la avería o el trabajo (entre 5 y 500 letras)',
    });
    expect(estado.valores).toEqual({});
    expect(crearOrden).not.toHaveBeenCalled();
  });
});

describe('crearOrdenAccion: cuando falla la base de datos', () => {
  it('[C-11] una matrícula que ya existe se explica junto al campo de la matrícula', async () => {
    vi.mocked(crearOrden).mockRejectedValue(new MatriculaRepetida());

    const estado = await crearOrdenAccion(ANTES, formulario(VEHICULO_NUEVO));

    expect(estado.errores).toEqual({
      matricula: 'Ya hay un vehículo con esa matrícula. Elígelo en la lista de vehículos.',
    });
    expect(estado.motivo).toBeNull();
    expect(estado.valores.marca).toBe('Seat');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('[D-14] cualquier otra excepción se cuenta encima del formulario, en español y sin su texto', async () => {
    vi.mocked(crearOrden).mockRejectedValue(new TypeError('fetch failed'));

    const estado = await crearOrdenAccion(ANTES, formulario(VEHICULO_NUEVO));

    expect(estado.errores).toEqual({});
    expect(estado.motivo).toBe('No se pudo crear la orden. Inténtalo de nuevo.');
    expect(estado.valores.matricula).toBe('1234 bcd');
    expect(redirect).not.toHaveBeenCalled();
  });
});
