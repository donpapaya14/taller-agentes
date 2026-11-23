import { afterAll, describe, expect, it } from 'vitest';
import { como, crearBd, sembrarDosTalleres } from './arnes';

const CREAR_RECAMBIO = `insert into public.recambios
                          (taller_id, referencia, nombre, precio_centimos, stock, stock_minimo)
                        values ($1, 'BUJ-03', 'Bujía', 990, 5, 1) returning id`;
const CAMBIAR_PRECIO = 'update public.recambios set precio_centimos = 1 where id = $1 returning id';
const BORRAR_RECAMBIO = 'delete from public.recambios where id = $1 returning id';
const BORRAR_ORDEN = 'delete from public.ordenes where id = $1 returning id';
const PONER_ESTADO = 'update public.ordenes set estado = $1 where id = $2 returning id';
// Sin precio: lo copia del recambio la base de datos.
const NUEVA_LINEA = `insert into public.orden_lineas (taller_id, orden_id, recambio_id, cantidad)
                     values ($1, $2, $3, 2)`;
const LINEA_CON_PRECIO = `insert into public.orden_lineas
                            (taller_id, orden_id, recambio_id, cantidad, precio_unitario_centimos)
                          values ($1, $2, $3, 1, $4)`;

const errorDePolitica = (tabla: string) =>
  `new row violates row-level security policy for table "${tabla}"`;

const bd = await crearBd();
const semilla = await sembrarDosTalleres(bd);

afterAll(() => bd.cerrar());

type Intento = readonly [texto: string, parametros: unknown[]];

// Cada intento, con cada usuario y por la API, choca con los permisos de la tabla antes de llegar
// a las políticas.
async function esperarSinPermiso(tabla: string, usuarios: string[], intentos: Intento[]) {
  for (const usuario of usuarios) {
    for (const [texto, parametros] of intentos) {
      const resultado = como(bd, usuario, (sql) => sql(texto, parametros));

      await expect(resultado, texto).rejects.toThrow(`permission denied for table ${tabla}`);
    }
  }
}

describe('recambios', () => {
  it('[C-3] el mecánico no crea, cambia ni borra recambios', async () => {
    await expect(
      como(bd, semilla.mecanicoA, (sql) => sql(CREAR_RECAMBIO, [semilla.tallerA])),
    ).rejects.toThrow(errorDePolitica('recambios'));

    const cambiados = await como(bd, semilla.mecanicoA, (sql) =>
      sql(CAMBIAR_PRECIO, [semilla.recambioA]),
    );
    const borrados = await como(bd, semilla.mecanicoA, (sql) =>
      sql(BORRAR_RECAMBIO, [semilla.recambioA]),
    );

    expect(cambiados).toEqual([]);
    expect(borrados).toEqual([]);
  });

  it('[C-3] el jefe crea, cambia y borra recambios', async () => {
    const afectados = await como(bd, semilla.jefeA, async (sql) => ({
      creados: await sql(CREAR_RECAMBIO, [semilla.tallerA]),
      cambiados: await sql(CAMBIAR_PRECIO, [semilla.recambioA]),
      borrados: await sql(BORRAR_RECAMBIO, [semilla.recambioA]),
    }));

    expect(afectados.creados).toHaveLength(1);
    expect(afectados.cambiados).toEqual([{ id: semilla.recambioA }]);
    expect(afectados.borrados).toEqual([{ id: semilla.recambioA }]);
  });
});

describe('órdenes', () => {
  it('[C-3] el mecánico no borra órdenes y el jefe sí', async () => {
    const porMecanico = await como(bd, semilla.mecanicoA, (sql) =>
      sql(BORRAR_ORDEN, [semilla.ordenA]),
    );
    const porJefe = await como(bd, semilla.jefeA, (sql) => sql(BORRAR_ORDEN, [semilla.ordenA]));

    expect(porMecanico).toEqual([]);
    expect(porJefe).toEqual([{ id: semilla.ordenA }]);
  });

  it('[C-3] nadie pone entregado con un update directo', async () => {
    for (const usuario of [semilla.jefeA, semilla.mecanicoA]) {
      const entrega = como(bd, usuario, async (sql) => {
        expect(await sql(PONER_ESTADO, ['en_reparacion', semilla.ordenA])).toHaveLength(1);
        expect(await sql(PONER_ESTADO, ['listo', semilla.ordenA])).toHaveLength(1);
        return sql(PONER_ESTADO, ['entregado', semilla.ordenA]);
      });

      await expect(entrega).rejects.toThrow(errorDePolitica('ordenes'));
    }
  });

  it('[C-3] el mecánico mueve la orden y añade líneas', async () => {
    const afectadas = await como(bd, semilla.mecanicoA, async (sql) => ({
      movidas: await sql(PONER_ESTADO, ['en_reparacion', semilla.ordenA]),
      lineas: await sql(`${NUEVA_LINEA} returning id`, [
        semilla.tallerA,
        semilla.ordenA,
        semilla.recambioA,
      ]),
    }));

    expect(afectadas.movidas).toEqual([{ id: semilla.ordenA }]);
    expect(afectadas.lineas).toHaveLength(1);
  });
});

describe('entrega y factura', () => {
  // Entregar, numerar y fijar el precio por hora es cosa de la base de datos: por la API esas
  // columnas no se escriben ni al crear la orden ni después.
  const crearOrdenCon = (columna: string, valor: string): Intento => [
    `insert into public.ordenes (taller_id, vehiculo_id, descripcion, ${columna})
     select taller_id, vehiculo_id, 'Nueva', ${valor} from public.ordenes where id = $1`,
    [semilla.ordenA],
  ];
  const cambiarOrden = (cambio: string): Intento => [
    `update public.ordenes set ${cambio} where id = $1`,
    [semilla.ordenA],
  ];
  const todos = [semilla.jefeA, semilla.mecanicoA];

  it('[C-3] nadie crea una orden entregada ni pone el número de factura a mano', async () => {
    await esperarSinPermiso('ordenes', todos, [
      crearOrdenCon('estado', `'entregado'`),
      crearOrdenCon('numero_factura', `'F-2026-0001'`),
      cambiarOrden(`numero_factura = 'F-2026-0001'`),
    ]);
  });

  it('[C-3] nadie escribe el precio por hora ni la fecha de entrega por API', async () => {
    await esperarSinPermiso('ordenes', todos, [
      cambiarOrden('precio_hora_centimos = 0'),
      cambiarOrden('entregada_en = now()'),
    ]);
  });

  it('[C-3] al crear una orden no se pueden enviar estado, precio ni número', async () => {
    await esperarSinPermiso(
      'ordenes',
      [semilla.mecanicoA],
      [
        crearOrdenCon('estado', `'recibido'`),
        crearOrdenCon('precio_hora_centimos', '0'),
        crearOrdenCon('numero_factura', `'F-1'`),
      ],
    );
  });
});

describe('precio de las líneas', () => {
  const lineaDeA = [semilla.tallerA, semilla.ordenA, semilla.recambioA];

  it('[C-3] el precio de la línea lo pone la base de datos', async () => {
    const porLaApi = await como(bd, semilla.mecanicoA, (sql) =>
      sql(`${NUEVA_LINEA} returning precio_unitario_centimos`, lineaDeA),
    );
    // Venga lo que venga en la fila, también de quien se salta los permisos de columna: aquí, el
    // superusuario en una transacción que se deshace.
    await bd.sql('begin');
    const comoSuperusuario = await bd
      .sql(`${LINEA_CON_PRECIO} returning precio_unitario_centimos`, [...lineaDeA, 1])
      .finally(() => bd.sql('rollback'));

    expect(porLaApi).toEqual([{ precio_unitario_centimos: 1250 }]);
    expect(comoSuperusuario).toEqual([{ precio_unitario_centimos: 1250 }]);
  });

  it('[C-3] nadie elige el precio de una línea', async () => {
    await esperarSinPermiso(
      'orden_lineas',
      [semilla.mecanicoA, semilla.jefeA],
      [
        [LINEA_CON_PRECIO, [...lineaDeA, 0]],
        [
          'update public.orden_lineas set precio_unitario_centimos = 0 where taller_id = $1',
          [semilla.tallerA],
        ],
      ],
    );
  });
});

describe('talleres y miembros', () => {
  // Por la API solo se leen: ni el mecánico se sube a jefe ni nadie toca la numeración de facturas.
  it('[C-2] [C-3] el mecánico no se sube a jefe y nadie escribe en miembros ni en talleres', async () => {
    const todos = [semilla.mecanicoA, semilla.jefeA];

    await esperarSinPermiso('miembros', todos, [
      [`update public.miembros set rol = 'jefe' where usuario_id = $1`, [semilla.mecanicoA]],
      [
        `insert into public.miembros (usuario_id, taller_id, rol, nombre)
         values ($1, $2, 'jefe', 'Intruso')`,
        [semilla.jefeB, semilla.tallerA],
      ],
      ['delete from public.miembros', []],
    ]);
    await esperarSinPermiso('talleres', todos, [
      ['update public.talleres set siguiente_factura = 1', []],
      [`insert into public.talleres (nombre) values ('Taller intruso')`, []],
      ['delete from public.talleres', []],
    ]);
  });
});

describe('clientes y vehículos', () => {
  const crearYBorrarClienteConVehiculo = (usuario: string) =>
    como(bd, usuario, async (sql) => {
      const [cliente] = await sql(
        `insert into public.clientes (taller_id, nombre) values ($1, 'Cliente nuevo') returning id`,
        [semilla.tallerA],
      );
      const [vehiculo] = await sql(
        `insert into public.vehiculos (taller_id, cliente_id, matricula)
         values ($1, $2, '9999 ZZZ') returning id`,
        [semilla.tallerA, cliente.id],
      );
      const borrados = [
        ...(await sql('delete from public.vehiculos where id = $1 returning id', [vehiculo.id])),
        ...(await sql('delete from public.clientes where id = $1 returning id', [cliente.id])),
      ];
      return borrados.length;
    });

  it('[C-3] el mecánico da de alta clientes y vehículos; solo el jefe los borra', async () => {
    expect(await crearYBorrarClienteConVehiculo(semilla.mecanicoA)).toBe(0);
    expect(await crearYBorrarClienteConVehiculo(semilla.jefeA)).toBe(2);
  });
});
