import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bien,
  claveRepetida,
  mal,
  preparar,
  type Llamada,
} from '../../../tests/apoyo/cliente-falso';
import { ID_LINEA, ID_ORDEN, ID_RECAMBIO, ID_TALLER } from '../../../tests/apoyo/filas-de-ejemplo';
import { anadirLinea, cambiarEstado, guardarManoObra, quitarLinea, rpcCerrar } from './ordenes';

vi.mock('./cliente-servidor', () =>
  import('../../../tests/apoyo/cliente-falso').then((modulo) => modulo.clienteServidorFalso),
);

afterEach(() => {
  vi.resetAllMocks();
});

// Los tres cambios que dicen true si tocaron una fila y false si no: lo que piden a Postgres y el
// mensaje con el que fallan.
const CAMBIOS: [string, () => Promise<boolean>, Llamada[], string][] = [
  [
    'cambiarEstado',
    () => cambiarEstado(ID_ORDEN, 'recibido', 'en_reparacion'),
    [
      ['from', 'ordenes'],
      ['update', { estado: 'en_reparacion' }],
      ['eq', 'id', ID_ORDEN],
      ['eq', 'estado', 'recibido'],
      ['select', 'id'],
    ],
    'No se pudo mover la orden. Inténtalo de nuevo.',
  ],
  [
    'guardarManoObra',
    () => guardarManoObra(ID_ORDEN, 90),
    [
      ['from', 'ordenes'],
      ['update', { mano_obra_minutos: 90 }],
      ['eq', 'id', ID_ORDEN],
      ['select', 'id'],
    ],
    'No se pudo guardar la mano de obra. Inténtalo de nuevo.',
  ],
  [
    'quitarLinea',
    () => quitarLinea(ID_LINEA),
    [['from', 'orden_lineas'], ['delete'], ['eq', 'id', ID_LINEA], ['select', 'id']],
    'No se pudo quitar el recambio. Inténtalo de nuevo.',
  ],
];

describe('cambios sobre una orden', () => {
  it.each(CAMBIOS)(
    '%s pide el cambio a Postgres y dice true si tocó la fila',
    async (_nombre, hacer, llamadas) => {
      const consultas = preparar(bien([{ id: ID_ORDEN }]));

      expect(await hacer()).toBe(true);
      expect(consultas).toEqual([llamadas]);
    },
  );

  it.each(CAMBIOS)('[C-4] %s dice false si no tocó ninguna fila', async (_nombre, hacer) => {
    preparar(bien([]));

    expect(await hacer()).toBe(false);
  });
});

describe('cambios sobre una orden, cuando algo falla', () => {
  it.each(CAMBIOS)(
    '[D-14] %s: si la base de datos falla, el mensaje se entiende',
    async (_nombre, hacer, _llamadas, mensaje) => {
      preparar(mal('permission denied for table ordenes', '42501'));

      await expect(hacer()).rejects.toThrow(new Error(mensaje));
    },
  );

  it.each(CAMBIOS)(
    '[D-2][D-14] %s: una respuesta que no son filas se rechaza',
    async (_nombre, hacer) => {
      preparar(bien([{ id: 'abc' }]));

      await expect(hacer()).rejects.toThrow(
        new Error(
          'No se entienden los datos de la respuesta de la base de datos. Avisa al administrador.',
        ),
      );
    },
  );
});

describe('anadirLinea', () => {
  const LINEA = { ordenId: ID_ORDEN, recambioId: ID_RECAMBIO, cantidad: 3, tallerId: ID_TALLER };

  it('inserta la línea sin precio ni upsert: el precio lo pone el disparador', async () => {
    const consultas = preparar(bien(null));

    expect(await anadirLinea(LINEA)).toBe(true);
    expect(consultas).toEqual([
      [
        ['from', 'orden_lineas'],
        [
          'insert',
          { taller_id: ID_TALLER, orden_id: ID_ORDEN, recambio_id: ID_RECAMBIO, cantidad: 3 },
        ],
      ],
    ]);
  });

  it('dice false si el recambio ya está en la orden', async () => {
    preparar(claveRepetida);

    expect(await anadirLinea(LINEA)).toBe(false);
  });

  it('[D-14] cualquier otro fallo de la base de datos da un mensaje que se entiende', async () => {
    preparar(mal('new row violates row-level security policy', '42501'));

    await expect(anadirLinea(LINEA)).rejects.toThrow(
      new Error('No se pudo añadir el recambio. Inténtalo de nuevo.'),
    );
  });
});

describe('rpcCerrar', () => {
  it('[C-5] llama a cerrar_orden y devuelve el número de factura', async () => {
    const consultas = preparar(bien('F-2026-0002'));

    expect(await rpcCerrar(ID_ORDEN)).toEqual({ numero: 'F-2026-0002' });
    expect(consultas).toEqual([[['rpc', 'cerrar_orden', { p_orden: ID_ORDEN }]]]);
  });

  it('[C-5][D-14] devuelve tal cual el mensaje de la excepción de Postgres', async () => {
    preparar(mal('STOCK_INSUFICIENTE:FIL-01', 'P0001'));

    expect(await rpcCerrar(ID_ORDEN)).toEqual({ error: 'STOCK_INSUFICIENTE:FIL-01' });
  });

  it.each([
    ['null', null],
    ['un número', 5],
    ['un texto vacío', ''],
    ['un objeto', { numero: 'F-2026-0002' }],
  ])(
    '[D-2] una respuesta que no es un número de factura (%s) se rechaza',
    async (_nombre, datos) => {
      preparar(bien(datos));

      expect(await rpcCerrar(ID_ORDEN)).toEqual({
        error: 'La base de datos no devolvió el número de factura',
      });
    },
  );
});
