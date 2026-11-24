import { describe, expect, it, vi } from 'vitest';
// Antes que los módulos de la aplicación: registra los falsos que estos van a encontrar.
import { prepararAcciones } from '../../../../../tests/apoyo/ordenes-falso';
import {
  anadirLinea,
  cambiarCantidad,
  cambiarEstado,
  guardarManoObra,
  quitarLinea,
  rpcCerrar,
} from '@/adaptadores/supabase/ordenes';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import { ID_LINEA, ID_ORDEN, ID_RECAMBIO } from '../../../../../tests/apoyo/filas-de-ejemplo';
import {
  almacen,
  avisoDejado,
  formulario,
  revalidatePath,
  rolFalso,
  SESION_JEFE,
  SESION_MECANICO,
} from '../../../../../tests/apoyo/next-falso';
import {
  anadirRecambio,
  cambiarCantidadDeLinea,
  entregarOrden,
  guardarMinutos,
  moverEstado,
  quitarRecambio,
} from './acciones';

prepararAcciones(SESION_JEFE);

type AccionDeLaFicha = {
  nombre: string;
  accion: (datos: FormData) => Promise<void>;
  campos: Record<string, string>;
  repositorio: (...argumentos: never[]) => Promise<unknown>;
  siLanza: string;
};

// Cada acción de la ficha con un formulario válido, el repositorio que toca y lo que dice si este
// lanza una excepción.
const ACCIONES: AccionDeLaFicha[] = [
  {
    nombre: 'moverEstado',
    accion: moverEstado,
    campos: { id: ID_ORDEN, de: 'recibido', a: 'en_reparacion' },
    repositorio: cambiarEstado,
    siLanza: 'No se pudo mover la orden. Inténtalo de nuevo.',
  },
  {
    nombre: 'entregarOrden',
    accion: entregarOrden,
    campos: { id: ID_ORDEN },
    repositorio: rpcCerrar,
    siLanza: 'No se pudo entregar la orden. Inténtalo de nuevo.',
  },
  {
    nombre: 'anadirRecambio',
    accion: anadirRecambio,
    campos: { ordenId: ID_ORDEN, recambioId: ID_RECAMBIO, cantidad: '2' },
    repositorio: anadirLinea,
    siLanza: 'No se pudo añadir el recambio. Inténtalo de nuevo.',
  },
  {
    nombre: 'cambiarCantidadDeLinea',
    accion: cambiarCantidadDeLinea,
    campos: { lineaId: ID_LINEA, cantidad: '4' },
    repositorio: cambiarCantidad,
    siLanza: 'No se pudo cambiar la cantidad. Inténtalo de nuevo.',
  },
  {
    nombre: 'quitarRecambio',
    accion: quitarRecambio,
    campos: { lineaId: ID_LINEA },
    repositorio: quitarLinea,
    siLanza: 'No se pudo quitar el recambio. Inténtalo de nuevo.',
  },
  {
    nombre: 'guardarMinutos',
    accion: guardarMinutos,
    campos: { ordenId: ID_ORDEN, minutos: '120' },
    repositorio: guardarManoObra,
    siLanza: 'No se pudo guardar la mano de obra. Inténtalo de nuevo.',
  },
];

describe('acciones de la ficha: lo común', () => {
  it.each(ACCIONES)('[C-1] $nombre sin sesión redirige a /login antes de tocar nada', async (a) => {
    vi.mocked(leerSesion).mockResolvedValue(null);

    await expect(a.accion(formulario(a.campos))).rejects.toThrow('REDIRIGE:/login');

    expect(a.repositorio).not.toHaveBeenCalled();
    expect(almacen.set).not.toHaveBeenCalled();
    expect(almacen.delete).not.toHaveBeenCalled();
  });

  it.each(ACCIONES)('[C-1] $nombre no confunde un fallo de la sesión con «sin sesión»', async (a) => {
    vi.mocked(leerSesion).mockRejectedValue(new Error('No se pudo cargar tu taller.'));

    await expect(a.accion(formulario(a.campos))).rejects.toThrow('No se pudo cargar tu taller.');
    expect(a.repositorio).not.toHaveBeenCalled();
  });

  it.each(ACCIONES)('[D-14] $nombre cuenta una excepción del repositorio en español, sin lanzar', async (a) => {
    vi.mocked(a.repositorio).mockRejectedValue(new TypeError('fetch failed'));

    await expect(a.accion(formulario(a.campos))).resolves.toBeUndefined();

    expect(avisoDejado()).toEqual({ tipo: 'error', texto: a.siLanza });
  });

  it.each(ACCIONES)('[D-14] $nombre borra antes el aviso anterior', async (a) => {
    await a.accion(formulario(a.campos));

    expect(almacen.delete).toHaveBeenCalledExactlyOnceWith('foso-aviso');
  });

  it.each(ACCIONES)('[C-10] $nombre actualiza la ficha y el tablero', async (a) => {
    await a.accion(formulario(a.campos));

    expect(revalidatePath.mock.calls).toEqual([['/ordenes/[id]', 'page'], ['/tablero']]);
  });
});

describe('acciones de la ficha: el permiso', () => {
  const DE_LINEAS = ACCIONES.filter(({ nombre }) =>
    ['anadirRecambio', 'cambiarCantidadDeLinea', 'quitarRecambio', 'guardarMinutos'].includes(nombre),
  );

  it.each(DE_LINEAS)('[C-3] $nombre, con un rol sin permiso, no llega a la base de datos', async (a) => {
    vi.mocked(leerSesion).mockResolvedValue({ ...SESION_JEFE, rol: rolFalso('visitante') });

    await a.accion(formulario(a.campos));

    expect(a.repositorio).not.toHaveBeenCalled();
    expect(avisoDejado()).toEqual({
      tipo: 'error',
      texto: 'No tienes permiso para cambiar esta orden',
    });
  });

  it.each(DE_LINEAS)('[C-3] $nombre lo puede hacer el mecánico', async (a) => {
    vi.mocked(leerSesion).mockResolvedValue(SESION_MECANICO);

    await a.accion(formulario(a.campos));

    expect(a.repositorio).toHaveBeenCalledTimes(1);
    expect(avisoDejado()).toBeNull();
  });

  it('[C-3] un rol sin permiso para mover tampoco mueve la orden', async () => {
    vi.mocked(leerSesion).mockResolvedValue({ ...SESION_JEFE, rol: rolFalso('visitante') });

    await moverEstado(formulario({ id: ID_ORDEN, de: 'recibido', a: 'en_reparacion' }));

    expect(cambiarEstado).not.toHaveBeenCalled();
    expect(avisoDejado()?.texto).toBe('No tienes permiso para mover órdenes');
  });
});
