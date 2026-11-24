import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cambiarEstado } from '@/adaptadores/supabase/ordenes';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import { ID_ORDEN } from '../../../../tests/apoyo/filas-de-ejemplo';
import {
  almacen,
  avisoDejado,
  formulario,
  navegarLanzando,
  revalidatePath,
  rolFalso,
  SESION_MECANICO,
} from '../../../../tests/apoyo/next-falso';
import { avanzarOrden } from './acciones';

vi.mock('@/adaptadores/supabase/sesion', () => ({ leerSesion: vi.fn() }));
vi.mock('@/adaptadores/supabase/ordenes', () => ({ cambiarEstado: vi.fn() }));

const SESION = SESION_MECANICO;

beforeEach(() => {
  vi.mocked(leerSesion).mockResolvedValue(SESION);
  vi.mocked(cambiarEstado).mockResolvedValue(true);
  navegarLanzando();
});

afterEach(() => vi.resetAllMocks());

describe('avanzarOrden: quién puede', () => {
  it('[C-1] sin sesión redirige a /login antes de tocar nada', async () => {
    vi.mocked(leerSesion).mockResolvedValue(null);

    await expect(avanzarOrden(formulario({ id: ID_ORDEN, de: 'recibido' }))).rejects.toThrow(
      'REDIRIGE:/login',
    );

    expect(cambiarEstado).not.toHaveBeenCalled();
    expect(almacen.set).not.toHaveBeenCalled();
    expect(almacen.delete).not.toHaveBeenCalled();
  });

  it('[C-1] un fallo al leer la sesión no se confunde con «sin sesión»', async () => {
    vi.mocked(leerSesion).mockRejectedValue(new Error('No se pudo cargar tu taller.'));

    await expect(avanzarOrden(formulario({ id: ID_ORDEN, de: 'recibido' }))).rejects.toThrow(
      'No se pudo cargar tu taller.',
    );
    expect(cambiarEstado).not.toHaveBeenCalled();
  });

  it('[C-3] un rol que no puede mover órdenes no llega a la base de datos y lo oye', async () => {
    vi.mocked(leerSesion).mockResolvedValue({ ...SESION, rol: rolFalso('visitante') });

    await avanzarOrden(formulario({ id: ID_ORDEN, de: 'recibido' }));

    expect(cambiarEstado).not.toHaveBeenCalled();
    expect(avisoDejado()).toEqual({ tipo: 'error', texto: 'No tienes permiso para mover órdenes' });
  });
});

describe('avanzarOrden: mover la orden', () => {
  it.each(['mecanico', 'jefe'] as const)(
    '[C-10] el %s pasa la orden al estado que sigue al que vio en la tarjeta',
    async (rol) => {
      vi.mocked(leerSesion).mockResolvedValue({ ...SESION, rol });

      await avanzarOrden(formulario({ id: ID_ORDEN, de: 'recibido' }));

      expect(cambiarEstado).toHaveBeenCalledExactlyOnceWith(ID_ORDEN, 'recibido', 'en_reparacion');
      expect(avisoDejado()).toBeNull();
    },
  );

  it('[C-10] de «en reparación» pasa a «listo»', async () => {
    await avanzarOrden(formulario({ id: ID_ORDEN, de: 'en_reparacion' }));

    expect(cambiarEstado).toHaveBeenCalledExactlyOnceWith(ID_ORDEN, 'en_reparacion', 'listo');
  });

  it('[C-10] revalida el tablero para que la tarjeta cambie de columna', async () => {
    await avanzarOrden(formulario({ id: ID_ORDEN, de: 'recibido' }));

    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/tablero');
  });

  it('[C-4] una orden «lista» no se entrega desde el tablero: se dice dónde se entrega', async () => {
    await avanzarOrden(formulario({ id: ID_ORDEN, de: 'listo' }));

    expect(cambiarEstado).not.toHaveBeenCalled();
    expect(avisoDejado()).toEqual({
      tipo: 'error',
      texto: 'Entregar se hace desde la ficha de la orden',
    });
  });

  it('[C-4] una orden entregada no cambia más', async () => {
    await avanzarOrden(formulario({ id: ID_ORDEN, de: 'entregado' }));

    expect(cambiarEstado).not.toHaveBeenCalled();
    expect(avisoDejado()).toEqual({
      tipo: 'error',
      texto: 'Ese cambio de estado no está permitido',
    });
  });

  it('[C-4] si otra persona movió antes la orden, el motivo se muestra y el tablero se actualiza', async () => {
    vi.mocked(cambiarEstado).mockResolvedValue(false);

    await avanzarOrden(formulario({ id: ID_ORDEN, de: 'recibido' }));

    expect(avisoDejado()).toEqual({
      tipo: 'error',
      texto: 'Otra persona ya movió esta orden. Recarga el tablero',
    });
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/tablero');
  });
});

describe('avanzarOrden: lo que llega del formulario', () => {
  it.each([
    ['sin id', { de: 'recibido' }, 'No encontramos esa orden'],
    ['un id que no es uuid', { id: "1'; drop table ordenes;--", de: 'recibido' }, 'No encontramos esa orden'],
    ['un id que es un archivo', { id: new File(['x'], 'x.txt'), de: 'recibido' }, 'No encontramos esa orden'],
    ['sin estado de origen', { id: ID_ORDEN }, 'Ese cambio de estado no está permitido'],
    ['un estado que no existe', { id: ID_ORDEN, de: 'volando' }, 'Ese cambio de estado no está permitido'],
    ['un estado que es un archivo', { id: ID_ORDEN, de: new File(['x'], 'x.txt') }, 'Ese cambio de estado no está permitido'],
  ])('[D-2] %s no llega a la base de datos y se explica', async (_caso, campos, texto) => {
    await avanzarOrden(formulario(campos));

    expect(cambiarEstado).not.toHaveBeenCalled();
    expect(avisoDejado()).toEqual({ tipo: 'error', texto });
  });
});

describe('avanzarOrden: cuando falla el repositorio', () => {
  it('[D-14] la excepción no sube a la pantalla de error: sale como aviso en español', async () => {
    vi.mocked(cambiarEstado).mockRejectedValue(new Error('No se pudo mover la orden. Inténtalo de nuevo.'));

    await expect(avanzarOrden(formulario({ id: ID_ORDEN, de: 'recibido' }))).resolves.toBeUndefined();

    expect(avisoDejado()).toEqual({
      tipo: 'error',
      texto: 'No se pudo mover la orden. Inténtalo de nuevo.',
    });
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/tablero');
  });

  it('[D-14] una excepción cualquiera tampoco enseña su texto', async () => {
    vi.mocked(cambiarEstado).mockRejectedValue(new TypeError('fetch failed'));

    await avanzarOrden(formulario({ id: ID_ORDEN, de: 'recibido' }));

    expect(avisoDejado()?.texto).toBe('No se pudo mover la orden. Inténtalo de nuevo.');
  });

  it('[D-14] antes de mover borra el aviso anterior, para que no se arrastre', async () => {
    await avanzarOrden(formulario({ id: ID_ORDEN, de: 'recibido' }));

    expect(almacen.delete).toHaveBeenCalledExactlyOnceWith('foso-aviso');
  });
});
