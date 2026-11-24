import { describe, expect, it, vi } from 'vitest';
// Antes que los módulos de la aplicación: registra los falsos que estos van a encontrar.
import { prepararAcciones } from '../../../../../tests/apoyo/ordenes-falso';
import { cambiarEstado, rpcCerrar } from '@/adaptadores/supabase/ordenes';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import { ID_ORDEN } from '../../../../../tests/apoyo/filas-de-ejemplo';
import {
  avisoDejado,
  formulario,
  SESION_JEFE,
  SESION_MECANICO,
} from '../../../../../tests/apoyo/next-falso';
import { entregarOrden, moverEstado } from './acciones';

prepararAcciones(SESION_MECANICO);

const mover = (de: string, a: string) => moverEstado(formulario({ id: ID_ORDEN, de, a }));

describe('moverEstado', () => {
  it.each([
    ['avanza', 'recibido', 'en_reparacion'],
    ['avanza otra vez', 'en_reparacion', 'listo'],
    ['retrocede', 'en_reparacion', 'recibido'],
    ['retrocede otra vez', 'listo', 'en_reparacion'],
  ])('[C-4] %s de %s a %s', async (_paso, de, a) => {
    await mover(de, a);

    expect(cambiarEstado).toHaveBeenCalledExactlyOnceWith(ID_ORDEN, de, a);
    expect(avisoDejado()).toBeNull();
  });

  it('[C-4] entregar no es un cambio de estado: se dice dónde se hace', async () => {
    await mover('listo', 'entregado');

    expect(cambiarEstado).not.toHaveBeenCalled();
    expect(avisoDejado()?.texto).toBe('Entregar se hace desde la ficha de la orden');
  });

  it.each([
    ['saltarse un estado', 'recibido', 'listo'],
    ['quedarse donde está', 'recibido', 'recibido'],
    ['mover una entregada', 'entregado', 'listo'],
    ['un estado que no existe', 'volando', 'recibido'],
  ])('[C-4] %s no vale', async (_caso, de, a) => {
    await mover(de, a);

    expect(cambiarEstado).not.toHaveBeenCalled();
    expect(avisoDejado()?.texto).toBe('Ese cambio de estado no está permitido');
  });

  it('[C-4] si otra persona movió antes la orden, lo dice', async () => {
    vi.mocked(cambiarEstado).mockResolvedValue(false);

    await mover('recibido', 'en_reparacion');

    expect(avisoDejado()?.texto).toBe('Otra persona ya movió esta orden. Recarga el tablero');
  });

  it('[D-2] un id que no es uuid no llega a la base de datos', async () => {
    await moverEstado(formulario({ id: '../../x', de: 'recibido', a: 'en_reparacion' }));

    expect(cambiarEstado).not.toHaveBeenCalled();
    expect(avisoDejado()?.texto).toBe('No encontramos esa orden');
  });

  it('[D-2] sin campos no llega a la base de datos y no lanza', async () => {
    await expect(moverEstado(formulario({}))).resolves.toBeUndefined();

    expect(cambiarEstado).not.toHaveBeenCalled();
  });
});

describe('entregarOrden', () => {
  const entregar = (id: string = ID_ORDEN) => entregarOrden(formulario({ id }));

  it('[C-5][C-8] el jefe entrega la orden y el aviso dice el número de su factura', async () => {
    vi.mocked(leerSesion).mockResolvedValue(SESION_JEFE);

    await entregar();

    expect(rpcCerrar).toHaveBeenCalledExactlyOnceWith(ID_ORDEN);
    expect(avisoDejado()).toEqual({ tipo: 'ok', texto: 'Orden entregada. Factura F-2026-0001' });
  });

  it('[C-3] el mecánico no llega a la base de datos al entregar y oye por qué', async () => {
    await entregar();

    expect(rpcCerrar).not.toHaveBeenCalled();
    expect(avisoDejado()).toEqual({
      tipo: 'error',
      texto: 'Solo el jefe de taller puede entregar una orden',
    });
  });

  it('[C-5] si falta stock de un recambio, el aviso nombra su referencia', async () => {
    vi.mocked(leerSesion).mockResolvedValue(SESION_JEFE);
    vi.mocked(rpcCerrar).mockResolvedValue({ error: 'STOCK_INSUFICIENTE:FIL-01' });

    await entregar();

    expect(avisoDejado()).toEqual({
      tipo: 'error',
      texto: 'No hay stock suficiente de FIL-01. Revisa el almacén antes de entregar',
    });
  });

  it.each([
    ['ESTADO_INVALIDO', 'La orden tiene que estar en «Listo» para entregarla'],
    ['ORDEN_NO_ENCONTRADA', 'No encontramos esa orden'],
    ['INTERBLOQUEO', 'Otra persona está entregando órdenes a la vez. Inténtalo de nuevo en unos segundos'],
    ['NUMERO_REPETIDO', 'No se pudo asignar el número de factura. Avisa al administrador'],
    ['algo que nadie esperaba', 'No se pudo entregar la orden. Inténtalo de nuevo'],
  ])('[D-14] el error %s sale en español', async (error, texto) => {
    vi.mocked(leerSesion).mockResolvedValue(SESION_JEFE);
    vi.mocked(rpcCerrar).mockResolvedValue({ error });

    await entregar();

    expect(avisoDejado()).toEqual({ tipo: 'error', texto });
  });

  it('[D-2] un id que no es uuid no llega a la base de datos', async () => {
    vi.mocked(leerSesion).mockResolvedValue(SESION_JEFE);

    await entregar('no-soy-un-uuid');

    expect(rpcCerrar).not.toHaveBeenCalled();
    expect(avisoDejado()?.texto).toBe('No encontramos esa orden');
  });
});
