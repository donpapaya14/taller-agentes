import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  algunaFilaTocada,
  filaId,
  filaOrdenDetalle,
  filaOrdenResumen,
  filaRecambio,
  filaVehiculo,
  leerFilas,
  SELECCION_ORDEN_DETALLE,
  SELECCION_ORDEN_RESUMEN,
  SELECCION_RECAMBIO,
  SELECCION_VEHICULO,
} from './filas';
import {
  FILA_DETALLE,
  FILA_LINEA,
  FILA_RECAMBIO,
  FILA_RESUMEN,
  FILA_VEHICULO,
  ID_LINEA,
  ID_ORDEN,
  ID_RECAMBIO,
  ORDEN_RESUMEN,
  RECAMBIO,
} from '../../../tests/apoyo/filas-de-ejemplo';

const NO_SON_FILAS: [string, unknown][] = [
  ['null', null],
  ['un texto', 'x'],
  ['un número', 5],
  ['una lista vacía', []],
  ['una lista con una fila', [FILA_RECAMBIO]],
];

const conVehiculo = (cambios: object) => ({
  ...FILA_RESUMEN,
  vehiculos: { ...FILA_RESUMEN.vehiculos, ...cambios },
});

describe('filaOrdenResumen', () => {
  it('pasa la fila de la base de datos a la forma de la aplicación', () => {
    expect(filaOrdenResumen.parse(FILA_RESUMEN)).toEqual(ORDEN_RESUMEN);
  });

  it('una orden entregada trae su fecha de entrega', () => {
    const entrega = '2026-11-20T10:00:00+00:00';
    const fila = { ...FILA_RESUMEN, estado: 'entregado', entregada_en: entrega };

    expect(filaOrdenResumen.parse(fila)).toMatchObject({
      estado: 'entregado',
      entregadaEn: entrega,
    });
  });

  it.each([
    ['sin marca', { marca: null }, 'Ibiza'],
    ['sin modelo', { modelo: null }, 'Seat'],
    ['sin marca ni modelo', { marca: null, modelo: null }, ''],
  ])('el vehículo %s se nombra con lo que haya', (_nombre, cambios, vehiculo) => {
    expect(filaOrdenResumen.parse(conVehiculo(cambios))).toMatchObject({ vehiculo });
  });
});

describe('filaOrdenResumen, entrada basura', () => {
  it('[D-2] una fila de orden con estado desconocido se rechaza', () => {
    expect(filaOrdenResumen.safeParse({ ...FILA_RESUMEN, estado: 'roto' }).success).toBe(false);
  });

  it.each([
    ['sin vehículo', { ...FILA_RESUMEN, vehiculos: undefined }],
    ['con el vehículo nulo', { ...FILA_RESUMEN, vehiculos: null }],
    ['con el cliente como lista', conVehiculo({ clientes: [FILA_RESUMEN.vehiculos.clientes] })],
    ['con el cliente sin nombre', conVehiculo({ clientes: { telefono: null } })],
    ['con un id que no es uuid', { ...FILA_RESUMEN, id: 'abc' }],
    ['con la descripción numérica', { ...FILA_RESUMEN, descripcion: 12 }],
    ['con la entrega escrita a mano', { ...FILA_RESUMEN, entregada_en: 'ayer' }],
    ['con una columna de más', { ...FILA_RESUMEN, precio_hora_centimos: 4500 }],
    ['sin estado', { ...FILA_RESUMEN, estado: undefined }],
  ])('[D-2] rechaza una fila %s', (_nombre, fila) => {
    expect(filaOrdenResumen.safeParse(fila).success).toBe(false);
  });

  it.each(NO_SON_FILAS)('[D-2] rechaza lo que no es una fila: %s', (_nombre, fila) => {
    expect(filaOrdenResumen.safeParse(fila).success).toBe(false);
  });
});

describe('filaOrdenDetalle', () => {
  it('pasa la fila de la base de datos a la forma de la aplicación', () => {
    expect(filaOrdenDetalle.parse(FILA_DETALLE)).toEqual({
      ...ORDEN_RESUMEN,
      clienteTelefono: '34612345678',
      marca: 'Seat',
      modelo: 'Ibiza',
      manoObraMinutos: 90,
      precioHoraCentimos: 4500,
      numeroFactura: null,
      creadaEn: '2026-11-23T20:41:00.123456+00:00',
      lineas: [
        {
          id: ID_LINEA,
          recambioId: ID_RECAMBIO,
          referencia: 'FIL-01',
          nombre: 'Filtro de aceite',
          cantidad: 2,
          precioUnitarioCentimos: 1250,
        },
      ],
    });
  });

  it('una orden entregada trae su número de factura', () => {
    const fila = { ...FILA_DETALLE, estado: 'entregado', numero_factura: 'F-2026-0001' };

    expect(filaOrdenDetalle.parse(fila)).toMatchObject({ numeroFactura: 'F-2026-0001' });
  });
});

describe('filaOrdenDetalle, datos que faltan y líneas', () => {
  it('un cliente sin teléfono y un vehículo sin marca ni modelo salen como texto vacío', () => {
    const fila = {
      ...FILA_DETALLE,
      vehiculos: {
        ...FILA_DETALLE.vehiculos,
        marca: null,
        modelo: null,
        clientes: { nombre: 'Marta Ruiz', telefono: null },
      },
    };

    expect(filaOrdenDetalle.parse(fila)).toMatchObject({
      clienteTelefono: '',
      marca: '',
      modelo: '',
    });
  });

  // Postgres no da las líneas en un orden estable y no hay fecha de alta que usar.
  it('ordena las líneas por referencia y, a igual referencia, por identificador', () => {
    const linea = (id: string, referencia: string) => ({
      ...FILA_LINEA,
      id,
      recambios: { ...FILA_LINEA.recambios, referencia },
    });
    const [a, b, c] = [
      'aaaaaaaa-0000-4000-8000-000000000001',
      'aaaaaaaa-0000-4000-8000-000000000002',
      'bbbbbbbb-0000-4000-8000-000000000003',
    ];
    const fila = {
      ...FILA_DETALLE,
      orden_lineas: [linea(c, 'FIL-02'), linea(b, 'FIL-01'), linea(a, 'FIL-01')],
    };

    expect(filaOrdenDetalle.parse(fila).lineas.map(({ id }) => id)).toEqual([a, b, c]);
  });
});

describe('filaOrdenDetalle, entrada basura', () => {
  const conLinea = (cambios: object) => ({
    ...FILA_DETALLE,
    orden_lineas: [{ ...FILA_LINEA, ...cambios }],
  });

  it.each([
    ['con una cantidad de cero', conLinea({ cantidad: 0 })],
    ['con la cantidad en texto', conLinea({ cantidad: '2' })],
    ['con la cantidad decimal', conLinea({ cantidad: 1.5 })],
    ['con un precio negativo en una línea', conLinea({ precio_unitario_centimos: -1 })],
    ['con una línea sin recambio', conLinea({ recambios: null })],
    ['con una línea con una columna de más', conLinea({ taller_id: ID_ORDEN })],
    ['con las líneas como objeto', { ...FILA_DETALLE, orden_lineas: FILA_LINEA }],
    ['con las líneas nulas', { ...FILA_DETALLE, orden_lineas: null }],
    ['con minutos negativos', { ...FILA_DETALLE, mano_obra_minutos: -1 }],
    ['con el precio por hora en texto', { ...FILA_DETALLE, precio_hora_centimos: '4500' }],
    ['sin fecha de alta', { ...FILA_DETALLE, creada_en: undefined }],
    ['con la fecha de alta escrita a mano', { ...FILA_DETALLE, creada_en: '23/11/2026' }],
    ['con el número de factura numérico', { ...FILA_DETALLE, numero_factura: 12 }],
    ['con una columna de más', { ...FILA_DETALLE, taller_id: ID_ORDEN }],
  ])('[D-2] rechaza una fila %s', (_nombre, fila) => {
    expect(filaOrdenDetalle.safeParse(fila).success).toBe(false);
  });

  it.each(NO_SON_FILAS)('[D-2] rechaza lo que no es una fila: %s', (_nombre, fila) => {
    expect(filaOrdenDetalle.safeParse(fila).success).toBe(false);
  });
});

describe('filaRecambio', () => {
  it('pasa la fila de la base de datos a la forma de la aplicación', () => {
    expect(filaRecambio.parse(FILA_RECAMBIO)).toEqual(RECAMBIO);
  });

  it.each([
    ['con stock negativo', { stock: -1 }],
    ['con stock en texto', { stock: '3' }],
    ['con stock decimal', { stock: 1.5 }],
    ['con el mínimo negativo', { stock_minimo: -1 }],
    ['con el precio negativo', { precio_centimos: -1 }],
    ['con el precio en euros con decimales', { precio_centimos: 12.5 }],
    ['con el precio en texto', { precio_centimos: '1250' }],
    ['con la referencia numérica', { referencia: 5 }],
    ['con un id que no es uuid', { id: 'abc' }],
    ['con una columna de más', { taller_id: ID_ORDEN }],
  ])('[D-2] una fila de recambio %s se rechaza', (_nombre, cambios) => {
    expect(filaRecambio.safeParse({ ...FILA_RECAMBIO, ...cambios }).success).toBe(false);
  });

  it.each(NO_SON_FILAS)('[D-2] rechaza lo que no es una fila: %s', (_nombre, fila) => {
    expect(filaRecambio.safeParse(fila).success).toBe(false);
  });
});

describe('filaVehiculo y filaId', () => {
  it.each([
    ['con marca y modelo', {}, 'Seat Ibiza'],
    ['sin marca', { marca: null }, 'Ibiza'],
    ['sin marca ni modelo', { marca: null, modelo: null }, ''],
  ])('un vehículo %s se etiqueta con lo que haya', (_nombre, cambios, etiqueta) => {
    expect(filaVehiculo.parse({ ...FILA_VEHICULO, ...cambios })).toEqual({
      id: ID_ORDEN,
      matricula: '1234BCD',
      etiqueta,
    });
  });

  it.each([
    ['sin matrícula', { matricula: undefined }],
    ['con un id vacío', { id: '' }],
    ['con la marca numérica', { marca: 4 }],
    ['con una columna de más', { cliente_id: ID_ORDEN }],
  ])('[D-2] rechaza un vehículo %s', (_nombre, cambios) => {
    expect(filaVehiculo.safeParse({ ...FILA_VEHICULO, ...cambios }).success).toBe(false);
  });

  it('[D-2] una fila de identificador solo lleva un uuid y nada más', () => {
    expect(filaId.parse({ id: ID_ORDEN })).toEqual({ id: ID_ORDEN });
    expect(filaId.safeParse({ id: '' }).success).toBe(false);
    expect(filaId.safeParse({ id: ID_ORDEN, estado: 'listo' }).success).toBe(false);
  });
});

describe('leerFilas', () => {
  const NO_ENTIENDE = 'No se entienden los datos de los recambios. Avisa al administrador.';
  const esquema = z.array(filaRecambio);

  it('devuelve las filas ya pasadas a la forma de la aplicación', () => {
    expect(leerFilas(esquema, [FILA_RECAMBIO], 'los recambios')).toEqual([RECAMBIO]);
  });

  it('[D-2][D-14] una fila rota no se devuelve: se lanza el mensaje y queda la causa', () => {
    const rota = [{ ...FILA_RECAMBIO, stock: -1 }];

    const lanzar = () => leerFilas(esquema, rota, 'los recambios');

    expect(lanzar).toThrow(new Error(NO_ENTIENDE));
    expect(lanzar).toThrow(expect.objectContaining({ cause: expect.any(z.ZodError) }));
  });
});

describe('algunaFilaTocada', () => {
  it.each([
    ['ninguna fila', false, []],
    ['una fila', true, [{ id: ID_ORDEN }]],
    ['varias filas', true, [{ id: ID_ORDEN }, { id: ID_LINEA }]],
  ])('con %s dice %s', (_nombre, tocada, filas) => {
    expect(algunaFilaTocada(filas)).toBe(tocada);
  });

  it.each([
    ['null', null],
    ['un objeto', { id: ID_ORDEN }],
    ['un texto', 'x'],
    ['filas con una columna de más', [{ id: ID_ORDEN, estado: 'listo' }]],
    ['filas sin uuid', [{ id: 'abc' }]],
  ])('[D-2][D-14] no entiende %s y lo dice', (_nombre, datos) => {
    const mensaje =
      'No se entienden los datos de la respuesta de la base de datos. Avisa al administrador.';

    expect(() => algunaFilaTocada(datos)).toThrow(new Error(mensaje));
  });
});

describe('las selecciones de columnas', () => {
  const clavesDe = (valor: unknown): string[] => {
    if (Array.isArray(valor)) return valor.flatMap(clavesDe);
    if (valor === null || typeof valor !== 'object') return [];
    return Object.entries(valor).flatMap(([clave, hijo]) => [clave, ...clavesDe(hijo)]);
  };

  it.each([
    ['resumen de orden', SELECCION_ORDEN_RESUMEN, FILA_RESUMEN],
    ['detalle de orden', SELECCION_ORDEN_DETALLE, FILA_DETALLE],
    ['vehículo', SELECCION_VEHICULO, FILA_VEHICULO],
    ['recambio', SELECCION_RECAMBIO, FILA_RECAMBIO],
  ])(
    'la selección de %s pide justo las columnas que acepta su esquema',
    (_nombre, seleccion, fila) => {
      const pedidas = seleccion.split(/[^a-z_]+/).filter(Boolean);

      expect(new Set(pedidas)).toEqual(new Set(clavesDe(fila)));
    },
  );
});
