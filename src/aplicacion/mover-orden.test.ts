import { describe, expect, it, vi } from 'vitest';
import { ESTADOS, type Estado } from '@/nucleo/orden';
import { moverOrden } from './mover-orden';

const ID = '9c1e7d52-0b3a-4f68-8a2d-6e4b1c7f3a90';

const NO_PERMITIDO = { ok: false, motivo: 'Ese cambio de estado no está permitido' };
const ENTREGAR_DESDE_LA_FICHA = {
  ok: false,
  motivo: 'Entregar se hace desde la ficha de la orden',
};
const YA_CAMBIO = { ok: false, motivo: 'Otra persona ya movió esta orden. Recarga el tablero' };

// Los cuatro movimientos que el tablero deja hacer: avanzar un paso o retroceder uno, sin entregar.
const PERMITIDOS: [Estado, Estado][] = [
  ['recibido', 'en_reparacion'],
  ['en_reparacion', 'listo'],
  ['en_reparacion', 'recibido'],
  ['listo', 'en_reparacion'],
];

const TODOS_LOS_PARES = ESTADOS.flatMap((de) => ESTADOS.map((a): [Estado, Estado] => [de, a]));

const puertoQue = (movida: boolean) => ({ cambiarEstado: vi.fn().mockResolvedValue(movida) });

// Un valor que el tipo no deja escribir pero que puede llegar de un formulario manipulado.
const estadoFalso = (texto: string) => texto as Estado;

describe('moverOrden', () => {
  it('[C-4] mover a un estado no contiguo no llega a la base de datos', async () => {
    const puerto = puertoQue(true);

    const resultado = await moverOrden({ id: ID, de: 'recibido', a: 'listo' }, puerto);

    expect(resultado).toEqual(NO_PERMITIDO);
    expect(puerto.cambiarEstado).not.toHaveBeenCalled();
  });

  it('[C-4] mover a entregado se rechaza', async () => {
    const puerto = puertoQue(true);

    const resultado = await moverOrden({ id: ID, de: 'listo', a: 'entregado' }, puerto);

    expect(resultado).toEqual(ENTREGAR_DESDE_LA_FICHA);
    expect(puerto.cambiarEstado).not.toHaveBeenCalled();
  });

  it('[C-4] una orden entregada no se mueve', async () => {
    const puerto = puertoQue(true);

    const resultado = await moverOrden({ id: ID, de: 'entregado', a: 'listo' }, puerto);

    expect(resultado).toEqual(NO_PERMITIDO);
    expect(puerto.cambiarEstado).not.toHaveBeenCalled();
  });

  it('[C-4] un movimiento permitido llega a la base de datos desde su estado', async () => {
    const puerto = puertoQue(true);

    const resultado = await moverOrden({ id: ID, de: 'recibido', a: 'en_reparacion' }, puerto);

    expect(resultado).toEqual({ ok: true });
    expect(puerto.cambiarEstado).toHaveBeenCalledExactlyOnceWith(ID, 'recibido', 'en_reparacion');
  });

  it('[C-4][D-14] si la orden ya cambió, lo dice', async () => {
    const resultado = await moverOrden(
      { id: ID, de: 'recibido', a: 'en_reparacion' },
      puertoQue(false),
    );

    expect(resultado).toEqual(YA_CAMBIO);
  });
});

describe('moverOrden, todos los pares de estados', () => {
  it.each(TODOS_LOS_PARES)('[C-4] %s → %s', async (de, a) => {
    const puerto = puertoQue(true);
    const llega = PERMITIDOS.some(([desde, hasta]) => desde === de && hasta === a);

    const resultado = await moverOrden({ id: ID, de, a }, puerto);

    expect(resultado.ok).toBe(llega);
    expect(puerto.cambiarEstado).toHaveBeenCalledTimes(llega ? 1 : 0);
  });
});

describe('moverOrden, entrada basura', () => {
  // `puedeTransicionar` da por buena una partida desconocida si el destino es «recibido».
  it('[C-4][D-2] un estado de partida que no existe no llega a la base de datos', async () => {
    const puerto = puertoQue(true);

    const resultado = await moverOrden({ id: ID, de: estadoFalso('roto'), a: 'recibido' }, puerto);

    expect(resultado).toEqual(NO_PERMITIDO);
    expect(puerto.cambiarEstado).not.toHaveBeenCalled();
  });

  it.each(['roto', '', 'Recibido', 'constructor'])(
    '[C-4][D-2] un estado de destino «%s» que no existe no llega a la base de datos',
    async (destino) => {
      const puerto = puertoQue(true);

      const resultado = await moverOrden(
        { id: ID, de: 'recibido', a: estadoFalso(destino) },
        puerto,
      );

      expect(resultado).toEqual(NO_PERMITIDO);
      expect(puerto.cambiarEstado).not.toHaveBeenCalled();
    },
  );
});
