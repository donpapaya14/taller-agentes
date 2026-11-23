import { afterAll, describe, expect, it } from 'vitest';
import { como, crearBd, type Sql, sembrarDosTalleres } from './arnes';

const TABLAS_CON_TALLER = [
  'miembros',
  'clientes',
  'vehiculos',
  'recambios',
  'ordenes',
  'orden_lineas',
] as const;
const TODAS_LAS_TABLAS = ['talleres', ...TABLAS_CON_TALLER, 'demo_control'];

const SEMBRADO_EN_A = {
  talleres: 1,
  miembros: 2,
  clientes: 1,
  vehiculos: 1,
  recambios: 2,
  ordenes: 1,
  orden_lineas: 1,
};
const SEMBRADO_EN_B = { ...SEMBRADO_EN_A, miembros: 1 };
const NADA = Object.fromEntries(Object.keys(SEMBRADO_EN_A).map((tabla) => [tabla, 0]));

// Sin returning: con él, Postgres aplica también la política de lectura a la fila nueva, que
// taparía un fallo en la de inserción. Por la API de Supabase se puede insertar sin devolver nada.
const INSERTAR = {
  clientes: 'insert into public.clientes (taller_id, nombre) values ($1, $2)',
  vehiculos: 'insert into public.vehiculos (taller_id, cliente_id, matricula) values ($1, $2, $3)',
  recambios: `insert into public.recambios
                (taller_id, referencia, nombre, precio_centimos, stock, stock_minimo)
              values ($1, $2, $3, 990, 5, 1)`,
  ordenes: 'insert into public.ordenes (taller_id, vehiculo_id, descripcion) values ($1, $2, $3)',
  orden_lineas: `insert into public.orden_lineas
                   (taller_id, orden_id, recambio_id, cantidad, precio_unitario_centimos)
                 values ($1, $2, $3, 1, 1250)`,
};

const CAMBIOS_SOBRE_B = [
  [`update public.ordenes set descripcion = 'Cambiada' where id = $1 returning id`, 'ordenB'],
  ['update public.recambios set stock = 0 where id = $1 returning id', 'recambioB'],
  [`update public.clientes set nombre = 'Cambiado' where id = $1 returning id`, 'clienteB'],
  ['delete from public.ordenes where id = $1 returning id', 'ordenB'],
  ['delete from public.recambios where id = $1 returning id', 'recambioB'],
  ['delete from public.clientes where id = $1 returning id', 'clienteB'],
] as const;

// Sin where ni returning, solo deciden las políticas de update y de delete: se prueban solas.
const BARRIDO_SIN_FILTRO = [
  `update public.clientes set nombre = 'Cambiado'`,
  `update public.vehiculos set modelo = 'Cambiado'`,
  'update public.recambios set stock = 0',
  `update public.ordenes set descripcion = 'Cambiada'`,
  'update public.orden_lineas set cantidad = 9',
  'delete from public.orden_lineas',
  'delete from public.ordenes',
  'delete from public.vehiculos',
  'delete from public.clientes',
  'delete from public.recambios',
];

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

const errorDePolitica = (tabla: string) =>
  `new row violates row-level security policy for table "${tabla}"`;

const bd = await crearBd();
const semilla = await sembrarDosTalleres(bd);

afterAll(() => bd.cerrar());

// Las filas de un taller en cada tabla, como JSON, tal como las ve quien consulta.
async function filasDelTaller(sql: Sql, tallerId: string): Promise<Record<string, string[]>> {
  const filas: Record<string, string[]> = {};
  for (const tabla of ['talleres', ...TABLAS_CON_TALLER]) {
    const columna = tabla === 'talleres' ? 'id' : 'taller_id';
    const resultado = await sql(
      `select row_to_json(t)::text as fila from public.${tabla} t where ${columna} = $1 order by 1`,
      [tallerId],
    );
    filas[tabla] = resultado.map(({ fila }) => String(fila));
  }
  return filas;
}

const contar = (filas: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(filas).map(([tabla, lista]) => [tabla, lista.length]));

describe('lectura entre talleres', () => {
  it('[C-2] el jefe de A no ve filas de B en ninguna tabla', async () => {
    const vistoPorJefeA = await como(bd, semilla.jefeA, async (sql) => ({
      deA: contar(await filasDelTaller(sql, semilla.tallerA)),
      deB: contar(await filasDelTaller(sql, semilla.tallerB)),
    }));

    expect(contar(await filasDelTaller(bd.sql, semilla.tallerB))).toEqual(SEMBRADO_EN_B);
    expect(vistoPorJefeA.deB).toEqual(NADA);
    expect(vistoPorJefeA.deA).toEqual(SEMBRADO_EN_A);
  });

  it('[C-2] anon no lee ninguna tabla', async () => {
    for (const tabla of TODAS_LAS_TABLAS) {
      const lectura = como(bd, null, (sql) => sql(`select * from public.${tabla}`));

      await expect(lectura).rejects.toThrow(`permission denied for table ${tabla}`);
    }
  });
});

describe('inserciones entre talleres', () => {
  it('[C-2] el jefe de A no inserta en B', async () => {
    const intentos = [
      { tabla: 'clientes', parametros: [semilla.tallerB, 'Cliente intruso'] },
      { tabla: 'vehiculos', parametros: [semilla.tallerB, semilla.clienteB, '9999 ZZZ'] },
      { tabla: 'recambios', parametros: [semilla.tallerB, 'INTRUSO-01', 'Recambio intruso'] },
      { tabla: 'ordenes', parametros: [semilla.tallerB, semilla.vehiculoB, 'Orden intrusa'] },
      { tabla: 'orden_lineas', parametros: [semilla.tallerB, semilla.ordenB, semilla.recambioB] },
      // Etiquetada como de B aunque cuelgue de una orden de A.
      { tabla: 'orden_lineas', parametros: [semilla.tallerB, semilla.ordenA, semilla.recambioA] },
    ] as const;

    for (const { tabla, parametros } of intentos) {
      const insercion = como(bd, semilla.jefeA, (sql) => sql(INSERTAR[tabla], [...parametros]));

      await expect(insercion).rejects.toThrow(errorDePolitica(tabla));
    }
  });

  it('[C-2] el jefe de A sí inserta en su propio taller', async () => {
    const insertadas = await como(bd, semilla.jefeA, async (sql) => {
      const insertar = async (texto: string, parametros: unknown[]) =>
        (await sql(`${texto} returning id`, parametros))[0];
      const cliente = await insertar(INSERTAR.clientes, [semilla.tallerA, 'Cliente nuevo']);
      const vehiculo = await insertar(INSERTAR.vehiculos, [
        semilla.tallerA,
        cliente.id,
        '9999 ZZZ',
      ]);
      const orden = await insertar(INSERTAR.ordenes, [semilla.tallerA, vehiculo.id, 'Aceite']);
      const linea = await insertar(INSERTAR.orden_lineas, [
        semilla.tallerA,
        orden.id,
        semilla.recambioA,
      ]);
      const recambio = await insertar(INSERTAR.recambios, [semilla.tallerA, 'NUEVO-01', 'Bujía']);
      return [cliente, vehiculo, orden, linea, recambio];
    });

    expect(insertadas).toEqual(Array(5).fill({ id: expect.stringMatching(UUID) }));
  });

  it('[C-2] una línea de A no puede colgar de una orden de B', async () => {
    const insercion = como(bd, semilla.jefeA, (sql) =>
      sql(INSERTAR.orden_lineas, [semilla.tallerA, semilla.ordenB, semilla.recambioA]),
    );

    await expect(insercion).rejects.toThrow(errorDePolitica('orden_lineas'));
  });
});

describe('cambios entre talleres', () => {
  it('[C-2] el jefe de A no modifica ni borra filas de B', async () => {
    const antes = await filasDelTaller(bd.sql, semilla.tallerB);

    const afectadas = await como(bd, semilla.jefeA, async (sql) => {
      const filas = [];
      for (const [texto, id] of CAMBIOS_SOBRE_B) {
        filas.push(...(await sql(texto, [semilla[id]])));
      }
      return filas;
    });

    expect(contar(antes)).toEqual(SEMBRADO_EN_B);
    expect(afectadas).toEqual([]);
    expect(await filasDelTaller(bd.sql, semilla.tallerB)).toEqual(antes);
  });

  it('[C-2] el jefe de A no modifica ni borra filas de B ni sin filtro', async () => {
    const antes = await filasDelTaller(bd.sql, semilla.tallerB);

    const despues = await como(bd, semilla.jefeA, async (sql) => {
      for (const sentencia of BARRIDO_SIN_FILTRO) {
        await sql(sentencia);
      }
      // Vuelve a superusuario en la misma transacción: se ve lo que quedó, no lo que ve el jefe.
      await sql('reset role');
      return {
        deA: contar(await filasDelTaller(sql, semilla.tallerA)),
        deB: await filasDelTaller(sql, semilla.tallerB),
      };
    });

    expect(despues.deA).toEqual({ ...NADA, talleres: 1, miembros: 2 });
    expect(despues.deB).toEqual(antes);
  });
});

describe('cambio de taller', () => {
  it('[C-2] nadie cambia de taller una fila', async () => {
    for (const tabla of ['clientes', 'vehiculos', 'recambios', 'orden_lineas']) {
      const mudanza = como(bd, semilla.jefeA, (sql) =>
        sql(`update public.${tabla} set taller_id = $1`, [semilla.tallerB]),
      );

      await expect(mudanza).rejects.toThrow(errorDePolitica(tabla));
    }
    const mudanzaDeOrden = como(bd, semilla.jefeA, (sql) =>
      sql('update public.ordenes set taller_id = $1 where id = $2', [
        semilla.tallerB,
        semilla.ordenA,
      ]),
    );

    await expect(mudanzaDeOrden).rejects.toThrow('TALLER_INMUTABLE');
  });
});
