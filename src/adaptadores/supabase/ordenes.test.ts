import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bien,
  clienteServidorFalso,
  mal,
  preparar,
  type Llamada,
} from '../../../tests/apoyo/cliente-falso';
import {
  FILA_DETALLE,
  FILA_RESUMEN,
  FILA_VEHICULO,
  ID_LINEA,
  ID_ORDEN,
  ID_TALLER,
  ORDEN_RESUMEN,
} from '../../../tests/apoyo/filas-de-ejemplo';
import { SELECCION_ORDEN_DETALLE, SELECCION_ORDEN_RESUMEN, SELECCION_VEHICULO } from './filas';
import { crearOrden, leerOrden, listarOrdenes, listarVehiculos } from './ordenes';

vi.mock('./cliente-servidor', () =>
  import('../../../tests/apoyo/cliente-falso').then((modulo) => modulo.clienteServidorFalso),
);

const ID_CLIENTE = '2c8f5d0b-3e6a-4b4c-9d7e-0f1a2b3c4d5e';
const ID_VEHICULO = '4e0a7f2d-5b8c-4d6e-8f9a-1b2c3d4e5f60';

const MENSAJES = {
  leerOrdenes: 'No se pudieron cargar las órdenes. Inténtalo de nuevo en unos minutos.',
  leerOrden: 'No se pudo cargar la orden. Inténtalo de nuevo en unos minutos.',
  leerVehiculos: 'No se pudieron cargar los vehículos. Inténtalo de nuevo en unos minutos.',
  crear: 'No se pudo crear la orden. Inténtalo de nuevo.',
  matriculaRepetida: 'Ya hay un vehículo con esa matrícula. Elígelo en la lista de vehículos.',
};

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('listarOrdenes', () => {
  it('pide las abiertas y las entregadas esta semana, las más antiguas primero', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-23T12:00:00.000Z'));
    const consultas = preparar(bien([FILA_RESUMEN]));

    expect(await listarOrdenes()).toEqual([ORDEN_RESUMEN]);
    expect(consultas).toEqual([
      [
        ['from', 'ordenes'],
        ['select', SELECCION_ORDEN_RESUMEN],
        ['or', 'estado.neq.entregado,entregada_en.gte.2026-11-16T12:00:00.000Z'],
        ['order', 'creada_en', { ascending: true }],
      ],
    ]);
  });

  it('[D-2][D-14] una fila rota no se devuelve y se explica', async () => {
    preparar(bien([{ ...FILA_RESUMEN, estado: 'roto' }]));

    await expect(listarOrdenes()).rejects.toThrow(
      new Error('No se entienden los datos de las órdenes. Avisa al administrador.'),
    );
  });

  it('[D-14] si la base de datos falla, el mensaje no enseña el error técnico', async () => {
    preparar(mal('connection refused'));

    await expect(listarOrdenes()).rejects.toThrow(new Error(MENSAJES.leerOrdenes));
  });
});

describe('leerOrden', () => {
  it('lee la orden con su vehículo, su cliente y sus líneas', async () => {
    const consultas = preparar(bien(FILA_DETALLE));

    expect(await leerOrden(ID_ORDEN)).toMatchObject({ id: ID_ORDEN, lineas: [{ id: ID_LINEA }] });
    expect(consultas).toEqual([
      [
        ['from', 'ordenes'],
        ['select', SELECCION_ORDEN_DETALLE],
        ['eq', 'id', ID_ORDEN],
        ['maybeSingle'],
      ],
    ]);
  });

  it('si no hay orden con ese id, devuelve null', async () => {
    preparar(bien(null));

    expect(await leerOrden(ID_ORDEN)).toBeNull();
  });

  it.each(['', 'abc', '../../etc', `${ID_ORDEN}; drop table ordenes`])(
    '[D-2] un id que no es un uuid («%s») no llega a la base de datos',
    async (id) => {
      expect(await leerOrden(id)).toBeNull();
      expect(clienteServidorFalso.crearClienteServidor).not.toHaveBeenCalled();
    },
  );

  it('[D-2][D-14] una fila rota no se devuelve y se explica', async () => {
    preparar(bien({ ...FILA_DETALLE, orden_lineas: null }));

    await expect(leerOrden(ID_ORDEN)).rejects.toThrow(
      new Error('No se entienden los datos de la orden. Avisa al administrador.'),
    );
  });

  it('[D-14] si la base de datos falla, el mensaje se entiende', async () => {
    preparar(mal('timeout'));

    await expect(leerOrden(ID_ORDEN)).rejects.toThrow(new Error(MENSAJES.leerOrden));
  });
});

describe('listarVehiculos', () => {
  it('pide los vehículos por matrícula y les pone etiqueta', async () => {
    const consultas = preparar(bien([FILA_VEHICULO]));

    expect(await listarVehiculos()).toEqual([
      { id: ID_ORDEN, matricula: '1234BCD', etiqueta: 'Seat Ibiza' },
    ]);
    expect(consultas).toEqual([
      [
        ['from', 'vehiculos'],
        ['select', SELECCION_VEHICULO],
        ['order', 'matricula'],
      ],
    ]);
  });

  it('[D-2][D-14] una fila rota no se devuelve y se explica', async () => {
    preparar(bien([{ ...FILA_VEHICULO, matricula: null }]));

    await expect(listarVehiculos()).rejects.toThrow(
      new Error('No se entienden los datos de los vehículos. Avisa al administrador.'),
    );
  });

  it('[D-14] si la base de datos falla, el mensaje se entiende', async () => {
    preparar(mal('timeout'));

    await expect(listarVehiculos()).rejects.toThrow(new Error(MENSAJES.leerVehiculos));
  });
});

describe('crearOrden con un vehículo que ya existe', () => {
  const EXISTENTE = { descripcion: 'Cambio de aceite', vehiculoId: ID_VEHICULO };

  it('crea solo la orden, sin precio ni estado: los pone la base de datos', async () => {
    const consultas = preparar(bien({ id: ID_ORDEN }));

    expect(await crearOrden(EXISTENTE, ID_TALLER)).toEqual({ id: ID_ORDEN });
    expect(consultas).toEqual([
      [
        ['from', 'ordenes'],
        [
          'insert',
          { taller_id: ID_TALLER, vehiculo_id: ID_VEHICULO, descripcion: 'Cambio de aceite' },
        ],
        ['select', 'id'],
        ['single'],
      ],
    ]);
  });

  it('[D-14] si la base de datos falla, el mensaje se entiende', async () => {
    preparar(mal('violates foreign key constraint', '23503'));

    await expect(crearOrden(EXISTENTE, ID_TALLER)).rejects.toThrow(new Error(MENSAJES.crear));
  });
});

const NUEVO = {
  descripcion: 'Cambio de aceite',
  matricula: '1234BCD',
  marca: 'Seat',
  modelo: 'Ibiza',
  clienteNombre: 'Marta Ruiz',
  clienteTelefono: '34612345678',
};

// Las cuatro consultas de crear con vehículo y cliente nuevos, en el orden en que se hacen.
const TODO_BIEN = [
  bien(null),
  bien({ id: ID_CLIENTE }),
  bien({ id: ID_VEHICULO }),
  bien({ id: ID_ORDEN }),
];

const insertar = (tabla: string, fila: object): Llamada[] => [
  ['from', tabla],
  ['insert', fila],
  ['select', 'id'],
  ['single'],
];

describe('crearOrden con vehículo y cliente nuevos', () => {
  it('comprueba la matrícula y crea el cliente, el vehículo y la orden, en ese orden', async () => {
    const consultas = preparar(...TODO_BIEN);

    expect(await crearOrden(NUEVO, ID_TALLER)).toEqual({ id: ID_ORDEN });
    expect(consultas).toEqual([
      [['from', 'vehiculos'], ['select', 'id'], ['eq', 'matricula', '1234BCD'], ['maybeSingle']],
      insertar('clientes', { taller_id: ID_TALLER, nombre: 'Marta Ruiz', telefono: '34612345678' }),
      insertar('vehiculos', {
        taller_id: ID_TALLER,
        cliente_id: ID_CLIENTE,
        matricula: '1234BCD',
        marca: 'Seat',
        modelo: 'Ibiza',
      }),
      insertar('ordenes', {
        taller_id: ID_TALLER,
        vehiculo_id: ID_VEHICULO,
        descripcion: 'Cambio de aceite',
      }),
    ]);
  });

  it('si la matrícula ya existe en el taller, lo dice sin crear nada', async () => {
    const consultas = preparar(bien({ id: ID_VEHICULO }));

    await expect(crearOrden(NUEVO, ID_TALLER)).rejects.toThrow(
      new Error(MENSAJES.matriculaRepetida),
    );
    expect(consultas).toHaveLength(1);
  });
});

describe('crearOrden con vehículo y cliente nuevos, cuando algo falla', () => {
  it.each([
    ['la comprobación de la matrícula', 0],
    ['crear el cliente', 1],
    ['crear el vehículo', 2],
    ['crear la orden', 3],
  ])('[D-14] si falla %s, el mensaje se entiende y no se sigue', async (_paso, queFalla) => {
    const respuestas = TODO_BIEN.map((respuesta, i) => (i === queFalla ? mal('boom') : respuesta));
    const consultas = preparar(...respuestas);

    await expect(crearOrden(NUEVO, ID_TALLER)).rejects.toThrow(new Error(MENSAJES.crear));
    expect(consultas).toHaveLength(queFalla + 1);
  });

  it('[D-2][D-14] un identificador que no es un uuid no se usa', async () => {
    preparar(bien(null), bien({ id: 'abc' }));

    await expect(crearOrden(NUEVO, ID_TALLER)).rejects.toThrow(
      new Error('No se entienden los datos de lo que se acaba de crear. Avisa al administrador.'),
    );
  });

  it('[D-2][D-14] una respuesta rota sobre la matrícula no se toma por «ya existe»', async () => {
    const consultas = preparar(bien('algo que no es una fila'));

    await expect(crearOrden(NUEVO, ID_TALLER)).rejects.toThrow(
      new Error('No se entienden los datos de los vehículos. Avisa al administrador.'),
    );
    expect(consultas).toHaveLength(1);
  });
});
