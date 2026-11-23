import { afterAll, describe, expect, it } from 'vitest';
import { como, crearBd, type Sql, sembrarDosTalleres } from './arnes';
import { comoSuperusuario, intentar, pasarAUsuario, valor } from './ayudas';

const ENTREGAR = 'select public.cerrar_orden($1) as numero';
const LEER_ORDEN = `select estado, numero_factura, entregada_en is not null as con_fecha
                      from public.ordenes where id = $1`;
const STOCK = 'select stock from public.recambios where id = $1';
const STOCK_DEL_TALLER = 'select sum(stock)::int from public.recambios where taller_id = $1';
const SIGUIENTE_FACTURA = 'select siguiente_factura from public.talleres where id = $1';
const ANIO = `select to_char(now() at time zone 'Europe/Madrid', 'YYYY')`;
const SIN_ENTREGAR = { estado: 'listo', numero_factura: null, con_fecha: false };
const ORDEN_QUE_NO_EXISTE = '00000000-0000-4000-8000-000000000999';

const bd = await crearBd();
const semilla = await sembrarDosTalleres(bd);

afterAll(() => bd.cerrar());

type Linea = readonly [recambio: string, cantidad: number];

async function crearRecambio(taller: string, referencia: string, stock: number): Promise<string> {
  const [fila] = await bd.sql(
    `insert into public.recambios (taller_id, referencia, nombre, precio_centimos, stock)
     values ($1, $2, $2, 1000, $3) returning id`,
    [taller, referencia, stock],
  );
  return String(fila.id);
}

// Una orden del taller de `ordenBase`, ya en `estado` y con sus líneas: se inserta con el estado
// final porque un insert no pasa por ordenes_reglas. Como superusuario, fuera de `como`.
async function crearOrden(ordenBase: string, estado: string, lineas: Linea[] = []) {
  const [orden] = await bd.sql(
    `insert into public.ordenes (taller_id, vehiculo_id, descripcion, estado)
     select taller_id, vehiculo_id, 'Orden de prueba', $2::public.estado_orden
       from public.ordenes where id = $1
     returning id`,
    [ordenBase, estado],
  );
  for (const [recambio, cantidad] of lineas) {
    await bd.sql(
      `insert into public.orden_lineas (taller_id, orden_id, recambio_id, cantidad)
       select taller_id, id, $2, $3 from public.ordenes where id = $1`,
      [orden.id, recambio, cantidad],
    );
  }
  return String(orden.id);
}

const entregar = async (sql: Sql, orden: string) => String(await valor(sql, ENTREGAR, [orden]));

describe('descuento de stock', () => {
  it('[C-5] entregar descuenta el stock de cada línea', async () => {
    const aceite = await crearRecambio(semilla.tallerA, 'ACE-01', 10);
    const orden = await crearOrden(semilla.ordenA, 'listo', [
      [semilla.recambioA, 2],
      [aceite, 3],
    ]);

    const despues = await como(bd, semilla.jefeA, async (sql) => ({
      numero: await entregar(sql, orden),
      stocks: [await valor(sql, STOCK, [semilla.recambioA]), await valor(sql, STOCK, [aceite])],
      orden: await sql(LEER_ORDEN, [orden]),
    }));

    expect(despues.stocks).toEqual([8, 7]);
    expect(despues.orden).toEqual([
      { estado: 'entregado', numero_factura: despues.numero, con_fecha: true },
    ]);
  });

  it('[C-5] descuenta del taller de la orden y no de otro con la misma referencia', async () => {
    const orden = await crearOrden(semilla.ordenA, 'listo', [[semilla.recambioA, 2]]);

    const stocks = await como(bd, semilla.jefeA, async (sql) => {
      await entregar(sql, orden);
      return comoSuperusuario(sql, async () => [
        await valor(sql, STOCK, [semilla.recambioA]),
        await valor(sql, STOCK, [semilla.recambioB]),
      ]);
    });

    expect(stocks).toEqual([8, 10]);
  });
});

describe('entregas repetidas o vacías', () => {
  it('[C-5] entregar dos veces la misma orden no descuenta dos veces', async () => {
    const orden = await crearOrden(semilla.ordenA, 'listo', [[semilla.recambioA, 2]]);

    const despues = await como(bd, semilla.jefeA, async (sql) => {
      await entregar(sql, orden);
      return {
        segunda: await intentar(sql, ENTREGAR, [orden]),
        stock: await valor(sql, STOCK, [semilla.recambioA]),
      };
    });

    expect(despues).toEqual({ segunda: 'ESTADO_INVALIDO', stock: 8 });
  });

  it('[C-5] una orden sin líneas se entrega igual y no toca ningún stock', async () => {
    const orden = await crearOrden(semilla.ordenA, 'listo');

    const despues = await como(bd, semilla.jefeA, async (sql) => ({
      antes: await valor(sql, STOCK_DEL_TALLER, [semilla.tallerA]),
      numero: await entregar(sql, orden),
      ahora: await valor(sql, STOCK_DEL_TALLER, [semilla.tallerA]),
      orden: await sql(LEER_ORDEN, [orden]),
    }));

    expect(despues.ahora).toBe(despues.antes);
    expect(despues.orden).toEqual([
      { estado: 'entregado', numero_factura: despues.numero, con_fecha: true },
    ]);
  });
});

describe('sin stock suficiente', () => {
  it('[C-5] sin stock suficiente no cambia nada', async () => {
    // ACE-02 va antes que FIL-01: se descuenta primero y el fallo llega después, a mitad de camino.
    const aceite = await crearRecambio(semilla.tallerA, 'ACE-02', 10);
    const filtro = await crearRecambio(semilla.tallerA, 'FIL-01', 2);
    const orden = await crearOrden(semilla.ordenA, 'listo', [
      [aceite, 1],
      [filtro, 5],
    ]);

    const despues = await como(bd, semilla.jefeA, async (sql) => {
      const antes = await valor(sql, SIGUIENTE_FACTURA, [semilla.tallerA]);
      return {
        error: await intentar(sql, ENTREGAR, [orden]),
        stocks: [await valor(sql, STOCK, [aceite]), await valor(sql, STOCK, [filtro])],
        orden: await sql(LEER_ORDEN, [orden]),
        siguienteFactura: await valor(sql, SIGUIENTE_FACTURA, [semilla.tallerA]),
        antes,
      };
    });

    expect(despues).toEqual({
      error: 'STOCK_INSUFICIENTE:FIL-01',
      stocks: [10, 2],
      orden: [SIN_ENTREGAR],
      siguienteFactura: despues.antes,
      antes: despues.antes,
    });
  });
});

describe('quién puede entregar', () => {
  it('[C-3] el mecánico no puede entregar', async () => {
    const orden = await crearOrden(semilla.ordenA, 'listo', [[semilla.recambioA, 1]]);

    const despues = await como(bd, semilla.mecanicoA, async (sql) => ({
      error: await intentar(sql, ENTREGAR, [orden]),
      orden: await sql(LEER_ORDEN, [orden]),
    }));

    expect(despues).toEqual({ error: 'SOLO_JEFE', orden: [SIN_ENTREGAR] });
  });

  it('[C-3] SOLO_JEFE se decide antes de buscar la orden', async () => {
    const ordenDeB = await crearOrden(semilla.ordenB, 'listo');

    const errores = await como(bd, semilla.mecanicoA, async (sql) => [
      await intentar(sql, ENTREGAR, [ordenDeB]),
      await intentar(sql, ENTREGAR, [ORDEN_QUE_NO_EXISTE]),
    ]);

    expect(errores).toEqual(['SOLO_JEFE', 'SOLO_JEFE']);
  });

  it('[C-3] quien no es miembro de ningún taller no entrega', async () => {
    const [usuario] = await bd.sql(
      'insert into auth.users (id) values (gen_random_uuid()) returning id',
    );
    const orden = await crearOrden(semilla.ordenA, 'listo');

    const error = await como(bd, String(usuario.id), (sql) => intentar(sql, ENTREGAR, [orden]));

    expect(error).toBe('SOLO_JEFE');
  });

  it('[C-3] un visitante sin sesión no puede ejecutar cerrar_orden', async () => {
    const orden = await crearOrden(semilla.ordenA, 'listo');

    const intento = como(bd, null, (sql) => sql(ENTREGAR, [orden]));

    await expect(intento).rejects.toThrow('permission denied for function cerrar_orden');
  });
});

describe('orden de otro taller o en otro estado', () => {
  it('[C-2] el jefe de A no entrega una orden de B', async () => {
    const ordenDeB = await crearOrden(semilla.ordenB, 'listo', [[semilla.recambioB, 2]]);

    const despues = await como(bd, semilla.jefeA, async (sql) => ({
      error: await intentar(sql, ENTREGAR, [ordenDeB]),
      ...(await comoSuperusuario(sql, async () => ({
        orden: await sql(LEER_ORDEN, [ordenDeB]),
        stock: await valor(sql, STOCK, [semilla.recambioB]),
      }))),
    }));

    expect(despues).toEqual({ error: 'ORDEN_NO_ENCONTRADA', orden: [SIN_ENTREGAR], stock: 10 });
  });

  it.each(['recibido', 'en_reparacion', 'entregado'])(
    '[C-4] solo se entrega desde listo, no desde %s',
    async (estado) => {
      const orden = await crearOrden(semilla.ordenA, estado, [[semilla.recambioA, 1]]);

      const despues = await como(bd, semilla.jefeA, async (sql) => ({
        error: await intentar(sql, ENTREGAR, [orden]),
        stock: await valor(sql, STOCK, [semilla.recambioA]),
      }));

      expect(despues).toEqual({ error: 'ESTADO_INVALIDO', stock: 10 });
    },
  );

  it('[C-4] el estado se mira antes que el stock', async () => {
    const agotado = await crearRecambio(semilla.tallerA, 'AGO-01', 0);
    const orden = await crearOrden(semilla.ordenA, 'recibido', [[agotado, 1]]);

    const error = await como(bd, semilla.jefeA, (sql) => intentar(sql, ENTREGAR, [orden]));

    expect(error).toBe('ESTADO_INVALIDO');
  });

  it('[C-4] una orden entregada no admite cambios', async () => {
    const orden = await crearOrden(semilla.ordenA, 'listo');

    const cambio = como(bd, semilla.jefeA, async (sql) => {
      await entregar(sql, orden);
      return comoSuperusuario(sql, () =>
        sql(`update public.ordenes set descripcion = 'x' where id = $1`, [orden]),
      );
    });

    await expect(cambio).rejects.toThrow('ORDEN_CERRADA');
  });
});

describe('numeración de facturas', () => {
  it('[C-8] la numeración es correlativa por taller', async () => {
    const primeraDeA = await crearOrden(semilla.ordenA, 'listo');
    const segundaDeA = await crearOrden(semilla.ordenA, 'listo');
    const unicaDeB = await crearOrden(semilla.ordenB, 'listo');

    // Intercaladas: la de B sale entre las dos de A y no le quita ni le pone número a A.
    const numeros = await como(bd, semilla.jefeA, async (sql) => {
      const anio = await valor(sql, ANIO);
      const a1 = await entregar(sql, primeraDeA);
      await pasarAUsuario(sql, semilla.jefeB);
      const b1 = await entregar(sql, unicaDeB);
      await pasarAUsuario(sql, semilla.jefeA);
      return { anio, a: [a1, await entregar(sql, segundaDeA)], b: [b1] };
    });

    expect(numeros).toEqual({
      anio: expect.stringMatching(/^\d{4}$/),
      a: [`F-${numeros.anio}-0001`, `F-${numeros.anio}-0002`],
      b: [`F-${numeros.anio}-0001`],
    });
  });

  it('[C-8] pasado el 9999 el número crece sin recortarse', async () => {
    const primera = await crearOrden(semilla.ordenA, 'listo');
    const segunda = await crearOrden(semilla.ordenA, 'listo');

    const numeros = await como(bd, semilla.jefeA, async (sql) => {
      await comoSuperusuario(sql, () =>
        sql('update public.talleres set siguiente_factura = 9999 where id = $1', [semilla.tallerA]),
      );
      return [await entregar(sql, primera), await entregar(sql, segunda)];
    });

    expect(numeros).toEqual([
      expect.stringMatching(/^F-\d{4}-9999$/),
      expect.stringMatching(/^F-\d{4}-10000$/),
    ]);
  });
});

describe('defensa del esquema', () => {
  // Las claves ajenas compuestas ya impiden que una línea de A apunte a un recambio de B. Aquí se
  // quitan (con el disparador del precio) para comprobar que el filtro por taller de cerrar_orden
  // también funciona solo: no descuenta del recambio ajeno ni dice cómo se llama.
  it('[C-2] descuenta solo del taller de la orden aunque la clave ajena no lo impidiera', async () => {
    const ajeno = await crearRecambio(semilla.tallerB, 'AJENO-01', 10);
    const orden = await crearOrden(semilla.ordenA, 'listo');

    const despues = await como(bd, semilla.jefeA, async (sql) => {
      await comoSuperusuario(sql, async () => {
        await sql(
          'alter table public.orden_lineas drop constraint orden_lineas_taller_id_recambio_id_fkey',
        );
        await sql('alter table public.orden_lineas disable trigger orden_lineas_precio');
        await sql(
          `insert into public.orden_lineas
             (taller_id, orden_id, recambio_id, cantidad, precio_unitario_centimos)
           values ($1, $2, $3, 1, 1)`,
          [semilla.tallerA, orden, ajeno],
        );
      });
      return {
        error: await intentar(sql, ENTREGAR, [orden]),
        stockDeB: await comoSuperusuario(sql, () => valor(sql, STOCK, [ajeno])),
      };
    });

    expect(despues.error).toMatch(/^STOCK_INSUFICIENTE/);
    expect(despues.error).not.toContain('AJENO-01');
    expect(despues.stockDeB).toBe(10);
  });
});
