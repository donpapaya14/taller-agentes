import { afterAll, describe, expect, it } from 'vitest';
import { como, crearBd, type Sql, sembrarDosTalleres } from './arnes';
import { comoSuperusuario, intentar, valor } from './ayudas';

const ENTREGAR = 'select public.cerrar_orden($1) as numero';
const STOCK = 'select stock from public.recambios where id = $1';
const ESTADO = 'select estado from public.ordenes where id = $1';

const bd = await crearBd();
const semilla = await sembrarDosTalleres(bd);

afterAll(() => bd.cerrar());

// Una orden de A lista para entregar, con una línea de `cantidad` unidades de un recambio nuevo que
// tiene `stock`. Como superusuario, fuera de `como`: un insert no pasa por ordenes_reglas.
async function ordenListaCon(referencia: string, stock: number, cantidad: number) {
  const [recambio] = await bd.sql(
    `insert into public.recambios (taller_id, referencia, nombre, precio_centimos, stock)
     values ($1, $2, $2, 1000, $3) returning id`,
    [semilla.tallerA, referencia, stock],
  );
  const [orden] = await bd.sql(
    `insert into public.ordenes (taller_id, vehiculo_id, descripcion, estado)
     select taller_id, vehiculo_id, 'Orden de prueba', 'listo' from public.ordenes where id = $1
     returning id`,
    [semilla.ordenA],
  );
  await bd.sql(
    `insert into public.orden_lineas (taller_id, orden_id, recambio_id, cantidad)
     values ($1, $2, $3, $4)`,
    [semilla.tallerA, orden.id, recambio.id, cantidad],
  );
  return { orden: String(orden.id), recambio: String(recambio.id) };
}

// Pide la entrega como jefe de A y devuelve lo que respondió, el stock y el estado en que queda.
const entregando = (
  { orden, recambio }: { orden: string; recambio: string },
  pedir: (sql: Sql, orden: string) => Promise<unknown>,
) =>
  como(bd, semilla.jefeA, async (sql) => ({
    respuesta: await pedir(sql, orden),
    stock: await valor(sql, STOCK, [recambio]),
    estado: await valor(sql, ESTADO, [orden]),
  }));

describe('límite del stock', () => {
  it('[C-5] con el stock justo para la línea se entrega y el stock queda a 0', async () => {
    const lista = await ordenListaCon('LIM-01', 3, 3);

    const despues = await entregando(lista, (sql, orden) => valor(sql, ENTREGAR, [orden]));

    expect(despues).toEqual({
      respuesta: expect.stringMatching(/^F-\d{4}-\d{4}$/),
      stock: 0,
      estado: 'entregado',
    });
  });

  it('[C-5] con una unidad menos de la que pide la línea no se entrega y nada cambia', async () => {
    const lista = await ordenListaCon('LIM-02', 3, 4);

    const despues = await entregando(lista, (sql, orden) => intentar(sql, ENTREGAR, [orden]));

    expect(despues).toEqual({
      respuesta: 'STOCK_INSUFICIENTE:LIM-02',
      stock: 3,
      estado: 'listo',
    });
  });
});

// restablecer_demo bloquea primero el taller (borra su fila y, en cascada, lo que cuelga de ella) y
// después sus hijos. Si cerrar_orden fuera por los recambios y dejara el taller para el final,
// con las dos a la vez cada una esperaría a la otra y Postgres abortaría una (40P01). PGlite tiene
// una sola conexión y no puede provocar el cruce: la sonda mira, justo antes de descontar un
// recambio, si la fila del taller ya está bloqueada por la transacción en curso (for update deja
// su xid en xmax).
describe('orden de los bloqueos', () => {
  it('[C-5] bloquea la fila del taller antes de descontar el primer recambio', async () => {
    const { orden } = await ordenListaCon('LIM-03', 5, 2);

    const sonda = await como(bd, semilla.jefeA, async (sql) => {
      await comoSuperusuario(sql, async () => {
        await sql('create table public.sonda (taller_bloqueado boolean)');
        // Con la ruta completa: cerrar_orden corre con el search_path vacío y el disparador lo hereda.
        await sql(`create function public.sonda_recambio() returns trigger language plpgsql as $$
          begin
            insert into public.sonda
              select t.xmax = pg_current_xact_id()::xid from public.talleres t where t.id = new.taller_id;
            return new;
          end $$`);
        await sql(`create trigger sonda_recambio before update on public.recambios
                     for each row execute function public.sonda_recambio()`);
      });
      await valor(sql, ENTREGAR, [orden]);
      return comoSuperusuario(sql, () => sql('select taller_bloqueado from public.sonda'));
    });

    expect(sonda).toEqual([{ taller_bloqueado: true }]);
  });
});
