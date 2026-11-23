import { afterAll, describe, expect, it } from 'vitest';
import { como, crearBd, sembrarDosTalleres } from './arnes';
import { comoSuperusuario, intentar, valor } from './ayudas';

const bd = await crearBd();
const semilla = await sembrarDosTalleres(bd);
// En el taller A, de lo sembrado: la orden cuelga del vehículo, el vehículo del cliente y la línea
// del recambio que lleva.
const vehiculoA = String(
  await valor(bd.sql, 'select vehiculo_id from public.ordenes where id = $1', [semilla.ordenA]),
);
const clienteA = String(
  await valor(bd.sql, 'select cliente_id from public.vehiculos where id = $1', [vehiculoA]),
);
const recambioConLinea = String(
  await valor(bd.sql, 'select recambio_id from public.orden_lineas where orden_id = $1', [
    semilla.ordenA,
  ]),
);

afterAll(() => bd.cerrar());

const CON_ALGO_COLGANDO = [
  ['un cliente con vehículos', 'clientes', clienteA, 'vehiculos_taller_id_cliente_id_fkey'],
  ['un vehículo con órdenes', 'vehiculos', vehiculoA, 'ordenes_taller_id_vehiculo_id_fkey'],
  [
    'un recambio con líneas',
    'recambios',
    recambioConLinea,
    'orden_lineas_taller_id_recambio_id_fkey',
  ],
] as const;

describe('borrar lo que tiene algo colgando', () => {
  // Una clave ajena en cascada se llevaría por delante las órdenes, también las entregadas, que ya
  // nadie puede cambiar ni borrar: la factura desaparecería con su vehículo.
  it.each(CON_ALGO_COLGANDO)(
    '[C-4] no se puede borrar %s, ni el jefe por la API ni quien se salta la RLS',
    async (_que, tabla, id, restriccion) => {
      const borrar = `delete from public.${tabla} where id = $1`;

      const errores = await como(bd, semilla.jefeA, async (sql) => ({
        jefe: await intentar(sql, borrar, [id]),
        superusuario: await comoSuperusuario(sql, () => intentar(sql, borrar, [id])),
      }));

      expect(errores.jefe).toContain(`violates foreign key constraint "${restriccion}"`);
      expect(errores.superusuario).toContain(`violates foreign key constraint "${restriccion}"`);
    },
  );

  it('[C-4] lo que no tiene nada colgando sí se borra', async () => {
    const borrados = await como(bd, semilla.jefeA, async (sql) => {
      const [cliente] = await sql(
        `insert into public.clientes (taller_id, nombre) values ($1, 'Sin vehículos') returning id`,
        [semilla.tallerA],
      );
      const [vehiculo] = await sql(
        `insert into public.vehiculos (taller_id, cliente_id, matricula)
         values ($1, $2, '9999ZZZ') returning id`,
        [semilla.tallerA, cliente.id],
      );
      const [recambio] = await sql(
        `insert into public.recambios (taller_id, referencia, nombre, precio_centimos)
         values ($1, 'SIN-LINEAS', 'Sin líneas', 100) returning id`,
        [semilla.tallerA],
      );
      return [
        ...(await sql('delete from public.vehiculos where id = $1 returning id', [vehiculo.id])),
        ...(await sql('delete from public.clientes where id = $1 returning id', [cliente.id])),
        ...(await sql('delete from public.recambios where id = $1 returning id', [recambio.id])),
      ];
    });

    expect(borrados).toHaveLength(3);
  });
});
