import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bien,
  claveRepetida,
  mal,
  preparar,
  type Llamada,
  type Respuesta,
} from '../../../tests/apoyo/cliente-falso';
import {
  FILA_RECAMBIO,
  ID_RECAMBIO,
  ID_TALLER,
  RECAMBIO,
} from '../../../tests/apoyo/filas-de-ejemplo';
import { SELECCION_RECAMBIO } from './filas';
import { guardarRecambio, listarRecambios } from './recambios';

vi.mock('./cliente-servidor', () =>
  import('../../../tests/apoyo/cliente-falso').then((modulo) => modulo.clienteServidorFalso),
);

const DATOS = {
  referencia: 'FIL-01',
  nombre: 'Filtro de aceite',
  precioCentimos: 1250,
  stock: 5,
  stockMinimo: 2,
};

// Solo estas columnas se escriben por la API; el id y el taller no se cambian en una edición.
const COLUMNAS = {
  referencia: 'FIL-01',
  nombre: 'Filtro de aceite',
  precio_centimos: 1250,
  stock: 5,
  stock_minimo: 2,
};

// Sin id se crea; con id se edita. Siempre con insert o update, nunca con upsert: el permiso por
// columna de la API no deja a un upsert tocar el id ni el taller.
const FORMAS: [string, { id?: string }, Respuesta, Llamada[]][] = [
  [
    'crea',
    {},
    bien(null),
    [
      ['from', 'recambios'],
      ['insert', { taller_id: ID_TALLER, ...COLUMNAS }],
    ],
  ],
  [
    'edita',
    { id: ID_RECAMBIO },
    bien([{ id: ID_RECAMBIO }]),
    [
      ['from', 'recambios'],
      ['update', COLUMNAS],
      ['eq', 'id', ID_RECAMBIO],
      ['select', 'id'],
    ],
  ],
];

afterEach(() => {
  vi.resetAllMocks();
});

describe('listarRecambios', () => {
  it('pide los recambios por referencia y los pasa a la forma de la aplicación', async () => {
    const consultas = preparar(bien([FILA_RECAMBIO]));

    expect(await listarRecambios()).toEqual([RECAMBIO]);
    expect(consultas).toEqual([
      [
        ['from', 'recambios'],
        ['select', SELECCION_RECAMBIO],
        ['order', 'referencia'],
      ],
    ]);
  });

  it('[D-2][D-14] una fila con el stock negativo no se devuelve y se explica', async () => {
    preparar(bien([{ ...FILA_RECAMBIO, stock: -1 }]));

    await expect(listarRecambios()).rejects.toThrow(
      new Error('No se entienden los datos de los recambios. Avisa al administrador.'),
    );
  });

  it('[D-14] si la base de datos falla, el mensaje se entiende', async () => {
    preparar(mal('timeout'));

    await expect(listarRecambios()).rejects.toThrow(
      new Error('No se pudieron cargar los recambios. Inténtalo de nuevo en unos minutos.'),
    );
  });
});

// El resultado dice por qué no se guardó: una referencia repetida se corrige en el formulario; un
// recambio que no se toca (de otro taller, ya no existe, o lo edita quien no puede) no.
const GUARDADO = { ok: true };
const REFERENCIA_REPETIDA = { ok: false, motivo: 'referencia_repetida' };
const SIN_PERMISO_O_NO_ENCONTRADO = { ok: false, motivo: 'sin_permiso_o_no_encontrado' };

describe('guardarRecambio', () => {
  it.each(FORMAS)(
    'sin fallo %s la fila y dice que se guardó',
    async (_forma, id, respuesta, llamadas) => {
      const consultas = preparar(respuesta);

      expect(await guardarRecambio({ ...DATOS, ...id }, ID_TALLER)).toEqual(GUARDADO);
      expect(consultas).toEqual([llamadas]);
    },
  );

  it('[C-3] al editar, sin ninguna fila tocada dice que no hay permiso o no se encontró', async () => {
    preparar(bien([]));

    expect(await guardarRecambio({ ...DATOS, id: ID_RECAMBIO }, ID_TALLER)).toEqual(
      SIN_PERMISO_O_NO_ENCONTRADO,
    );
  });

  it.each(FORMAS)(
    '[D-14] si la referencia ya existe en el taller, %s dice que está repetida',
    async (_forma, id) => {
      preparar(claveRepetida);

      expect(await guardarRecambio({ ...DATOS, ...id }, ID_TALLER)).toEqual(REFERENCIA_REPETIDA);
    },
  );

  it('[D-14] una referencia repetida y una edición que no toca nada no se confunden', async () => {
    preparar(claveRepetida, bien([]));

    const repetida = await guardarRecambio({ ...DATOS, id: ID_RECAMBIO }, ID_TALLER);
    const sinTocar = await guardarRecambio({ ...DATOS, id: ID_RECAMBIO }, ID_TALLER);

    expect(repetida).not.toEqual(sinTocar);
  });
});

describe('guardarRecambio, cuando algo falla', () => {
  const GUARDAR = new Error('No se pudo guardar el recambio. Inténtalo de nuevo.');

  it.each(FORMAS)(
    '[C-3][D-14] si la base de datos lo rechaza, %s da un mensaje que se entiende',
    async (_forma, id) => {
      preparar(mal('new row violates row-level security policy for table "recambios"', '42501'));

      await expect(guardarRecambio({ ...DATOS, ...id }, ID_TALLER)).rejects.toThrow(GUARDAR);
    },
  );

  it('[D-2][D-14] al editar, una respuesta que no son filas se rechaza', async () => {
    preparar(bien({ id: ID_RECAMBIO }));

    await expect(guardarRecambio({ ...DATOS, id: ID_RECAMBIO }, ID_TALLER)).rejects.toThrow(
      new Error(
        'No se entienden los datos de la respuesta de la base de datos. Avisa al administrador.',
      ),
    );
  });
});
