import { afterAll, describe, expect, it } from 'vitest';
import { como, crearBd, sembrarDosTalleres } from './arnes';

const CREAR_RECAMBIO = `insert into public.recambios
                          (taller_id, referencia, nombre, precio_centimos, stock, stock_minimo)
                        values ($1, 'BUJ-03', 'Bujía', 990, 5, 1) returning id`;
const CAMBIAR_PRECIO = 'update public.recambios set precio_centimos = 1 where id = $1 returning id';
const BORRAR_RECAMBIO = 'delete from public.recambios where id = $1 returning id';
const BORRAR_ORDEN = 'delete from public.ordenes where id = $1 returning id';
const PONER_ESTADO = 'update public.ordenes set estado = $1 where id = $2 returning id';

const errorDePolitica = (tabla: string) =>
  `new row violates row-level security policy for table "${tabla}"`;

const bd = await crearBd();
const semilla = await sembrarDosTalleres(bd);

afterAll(() => bd.cerrar());

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
      lineas: await sql(
        `insert into public.orden_lineas (taller_id, orden_id, recambio_id, cantidad,
           precio_unitario_centimos)
         values ($1, $2, $3, 2, 1250) returning id`,
        [semilla.tallerA, semilla.ordenA, semilla.recambioA],
      ),
    }));

    expect(afectadas.movidas).toEqual([{ id: semilla.ordenA }]);
    expect(afectadas.lineas).toHaveLength(1);
  });
});

describe('entrega y factura', () => {
  // Entregar y numerar es cosa de una función de la base de datos, no de un insert o un update.
  const SALTARSE_LA_ENTREGA = [
    `insert into public.ordenes (taller_id, vehiculo_id, descripcion, estado)
     select taller_id, vehiculo_id, 'Ya entregada', 'entregado' from public.ordenes where id = $1`,
    `insert into public.ordenes (taller_id, vehiculo_id, descripcion, numero_factura)
     select taller_id, vehiculo_id, 'Con factura', 'F-2026-0001' from public.ordenes where id = $1`,
    `update public.ordenes set numero_factura = 'F-2026-0001' where id = $1`,
  ];

  it('[C-3] nadie crea una orden entregada ni pone el número de factura a mano', async () => {
    for (const usuario of [semilla.jefeA, semilla.mecanicoA]) {
      for (const texto of SALTARSE_LA_ENTREGA) {
        const intento = como(bd, usuario, (sql) => sql(texto, [semilla.ordenA]));

        await expect(intento).rejects.toThrow(errorDePolitica('ordenes'));
      }
    }
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
