import { afterAll, describe, expect, it } from 'vitest';
import { como, crearBd, sembrarDosTalleres } from './arnes';

const CICLO = ['recibido', 'en_reparacion', 'listo', 'entregado'] as const;
type Estado = (typeof CICLO)[number];

// Sin precio: lo copia del recambio la base de datos.
const INSERTAR_LINEA = `insert into public.orden_lineas (taller_id, orden_id, recambio_id, cantidad)
                        values ($1, $2, $3, 1)`;

const bd = await crearBd();
const semilla = await sembrarDosTalleres(bd);

// Una orden del taller A ya entregada y con su línea, como queda después de entregarla.
const [ordenEntregada] = await bd.sql(
  `insert into public.ordenes
     (taller_id, vehiculo_id, descripcion, estado, numero_factura, entregada_en)
   select taller_id, vehiculo_id, 'Ya entregada', 'entregado', 'F-2026-0001', now()
     from public.ordenes where id = $1
   returning id`,
  [semilla.ordenA],
);
await bd.sql(INSERTAR_LINEA, [semilla.tallerA, ordenEntregada.id, semilla.recambioA]);

afterAll(() => bd.cerrar());

// El disparador vale también para quien se salta la RLS (service_role o una función security
// definer), así que estas pruebas van como superusuario, en una transacción que se deshace.
async function comoSuperusuario(fn: () => Promise<void>): Promise<void> {
  await bd.sql('begin');
  try {
    await fn();
  } finally {
    await bd.sql('rollback');
  }
}

// Lleva la orden A desde 'recibido' hasta `estado` por los pasos del ciclo.
async function llevarOrdenA(estado: Estado): Promise<void> {
  for (const paso of CICLO.slice(1, CICLO.indexOf(estado) + 1)) {
    await bd.sql('update public.ordenes set estado = $1 where id = $2', [paso, semilla.ordenA]);
  }
}

const ponerOrdenA = (estado: Estado) =>
  bd.sql('update public.ordenes set estado = $1 where id = $2 returning estado', [
    estado,
    semilla.ordenA,
  ]);

describe('transiciones de una orden', () => {
  it('[C-4] la base de datos rechaza saltos de estado', async () => {
    const salto = como(bd, semilla.jefeA, (sql) =>
      sql(`update public.ordenes set estado = 'listo' where id = $1`, [semilla.ordenA]),
    );

    await expect(salto).rejects.toThrow('TRANSICION_INVALIDA');
  });

  it.each([
    ['recibido', 'en_reparacion'],
    ['en_reparacion', 'listo'],
    ['listo', 'entregado'],
    ['en_reparacion', 'recibido'],
    ['listo', 'en_reparacion'],
    ['recibido', 'recibido'],
    ['en_reparacion', 'en_reparacion'],
    ['listo', 'listo'],
  ] as const)('[C-4] acepta pasar de %s a %s', async (desde, hasta) => {
    await comoSuperusuario(async () => {
      await llevarOrdenA(desde);

      expect(await ponerOrdenA(hasta)).toEqual([{ estado: hasta }]);
    });
  });

  it.each([
    ['recibido', 'listo', 'TRANSICION_INVALIDA'],
    ['recibido', 'entregado', 'TRANSICION_INVALIDA'],
    ['en_reparacion', 'entregado', 'TRANSICION_INVALIDA'],
    ['listo', 'recibido', 'TRANSICION_INVALIDA'],
    ['entregado', 'recibido', 'ORDEN_CERRADA'],
    ['entregado', 'en_reparacion', 'ORDEN_CERRADA'],
    ['entregado', 'listo', 'ORDEN_CERRADA'],
    ['entregado', 'entregado', 'ORDEN_CERRADA'],
  ] as const)('[C-4] rechaza pasar de %s a %s con %s', async (desde, hasta, error) => {
    await comoSuperusuario(async () => {
      await llevarOrdenA(desde);

      await expect(ponerOrdenA(hasta)).rejects.toThrow(error);
    });
  });

  it('[C-2] una orden no cambia de taller ni saltándose la RLS', async () => {
    await comoSuperusuario(async () => {
      const mudanza = bd.sql('update public.ordenes set taller_id = $1 where id = $2', [
        semilla.tallerB,
        semilla.ordenA,
      ]);

      await expect(mudanza).rejects.toThrow('TALLER_INMUTABLE');
    });
  });
});

describe('orden entregada', () => {
  it('[C-4] una orden entregada no cambia, no se borra y sus líneas tampoco', async () => {
    const lineaNueva = como(bd, semilla.jefeA, (sql) =>
      sql(INSERTAR_LINEA, [semilla.tallerA, ordenEntregada.id, semilla.recambioA]),
    );
    await expect(lineaNueva).rejects.toThrow(
      'new row violates row-level security policy for table "orden_lineas"',
    );

    const afectadas = await como(bd, semilla.jefeA, async (sql) => {
      const sobreLaEntregada = (texto: string) => sql(texto, [ordenEntregada.id]);
      return {
        lineasVistas: await sobreLaEntregada(
          'select id from public.orden_lineas where orden_id = $1',
        ),
        orden: [
          ...(await sobreLaEntregada(
            `update public.ordenes set descripcion = 'Otra' where id = $1 returning id`,
          )),
          ...(await sobreLaEntregada('delete from public.ordenes where id = $1 returning id')),
        ],
        lineas: [
          ...(await sobreLaEntregada(
            'update public.orden_lineas set cantidad = 5 where orden_id = $1 returning id',
          )),
          ...(await sobreLaEntregada(
            'delete from public.orden_lineas where orden_id = $1 returning id',
          )),
        ],
      };
    });

    expect(afectadas).toEqual({ lineasVistas: [expect.anything()], orden: [], lineas: [] });
  });
});
