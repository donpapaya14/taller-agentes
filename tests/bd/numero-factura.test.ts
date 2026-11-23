import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { como, crearBd, sembrarDosTalleres } from './arnes';
import { comoSuperusuario, intentar, valor } from './ayudas';

const ENTREGAR = 'select public.cerrar_orden($1) as numero';
const NUMERO_REPETIDO =
  'duplicate key value violates unique constraint "ordenes_numero_factura_unico"';
// Una orden más en el taller de la orden dada, con ese estado y ese número de factura (puede ser
// null). Por SQL y como superusuario: la API no escribe ni el estado final ni el número.
const NUEVA_ORDEN = `insert into public.ordenes
                       (taller_id, vehiculo_id, descripcion, estado, numero_factura)
                     select taller_id, vehiculo_id, 'Orden de prueba', $2::public.estado_orden, $3
                       from public.ordenes where id = $1`;

const bd = await crearBd();
const semilla = await sembrarDosTalleres(bd);

afterAll(() => bd.cerrar());
// Un test que falle con el reloj cambiado no debe dejarlo así para el siguiente.
afterEach(() => {
  vi.useRealTimers();
});

const ordenLista = async () =>
  String(await valor(bd.sql, `${NUEVA_ORDEN} returning id`, [semilla.ordenA, 'listo', null]));

describe('un número de factura no se repite', () => {
  // Parcial: las órdenes sin entregar no tienen número y no hace falta indexarlas.
  it('[C-8] el índice es único, por taller y solo de las órdenes con número', async () => {
    const definicion = await valor(
      bd.sql,
      `select indexdef from pg_indexes
        where schemaname = 'public' and indexname = 'ordenes_numero_factura_unico'`,
    );

    expect(definicion).toBe(
      'CREATE UNIQUE INDEX ordenes_numero_factura_unico ON public.ordenes ' +
        'USING btree (taller_id, numero_factura) WHERE (numero_factura IS NOT NULL)',
    );
  });

  it('[C-8] dos órdenes del mismo taller no comparten número', async () => {
    const errores = await como(bd, semilla.jefeA, (sql) =>
      comoSuperusuario(sql, async () => [
        await intentar(sql, NUEVA_ORDEN, [semilla.ordenA, 'entregado', 'F-2026-0001']),
        await intentar(sql, NUEVA_ORDEN, [semilla.ordenA, 'entregado', 'F-2026-0001']),
      ]),
    );

    expect(errores).toEqual([null, NUMERO_REPETIDO]);
  });

  it('[C-8] el mismo número sí puede estar en otro taller', async () => {
    const errores = await como(bd, semilla.jefeA, (sql) =>
      comoSuperusuario(sql, async () => [
        await intentar(sql, NUEVA_ORDEN, [semilla.ordenA, 'entregado', 'F-2026-0001']),
        await intentar(sql, NUEVA_ORDEN, [semilla.ordenB, 'entregado', 'F-2026-0001']),
      ]),
    );

    expect(errores).toEqual([null, null]);
  });

  it('[C-8] las órdenes sin número no chocan entre sí', async () => {
    const errores = await como(bd, semilla.jefeA, (sql) =>
      comoSuperusuario(sql, async () => [
        await intentar(sql, NUEVA_ORDEN, [semilla.ordenA, 'recibido', null]),
        await intentar(sql, NUEVA_ORDEN, [semilla.ordenA, 'recibido', null]),
      ]),
    );

    expect(errores).toEqual([null, null]);
  });
});

describe('contador desajustado', () => {
  // El contador de talleres es lo que numera; el índice es la red por si alguien lo retrocede.
  it('[C-8] si el contador se desajusta, entregar falla en vez de repetir el número', async () => {
    const primera = await ordenLista();
    const segunda = await ordenLista();

    const despues = await como(bd, semilla.jefeA, async (sql) => {
      const numero = await valor(sql, ENTREGAR, [primera]);
      await comoSuperusuario(sql, () =>
        sql('update public.talleres set siguiente_factura = 1 where id = $1', [semilla.tallerA]),
      );
      return {
        numero,
        error: await intentar(sql, ENTREGAR, [segunda]),
        estado: await valor(sql, 'select estado from public.ordenes where id = $1', [segunda]),
      };
    });

    expect(despues).toEqual({
      numero: expect.stringMatching(/^F-\d{4}-0001$/),
      error: NUMERO_REPETIDO,
      estado: 'listo',
    });
  });
});

describe('año de la factura', () => {
  // Postgres lee la hora del reloj de JavaScript (PGlite corre en este proceso), así que se puede
  // fijar. La zona de la sesión es UTC, como en Supabase: el año que cuenta es el de Madrid.
  it.each([
    ['2026-12-31T23:30:00Z', '2027'],
    ['2026-12-31T22:30:00Z', '2026'],
    ['2027-01-01T00:30:00Z', '2027'],
  ])('[C-8] a las %s (UTC) el número lleva el año %s', async (instante, anio) => {
    const orden = await ordenLista();
    vi.setSystemTime(new Date(instante));

    const entrega = await como(bd, semilla.jefeA, async (sql) => ({
      numero: await valor(sql, ENTREGAR, [orden]),
      conLaHoraFijada: await valor(
        sql,
        'select entregada_en = $2::timestamptz from public.ordenes where id = $1',
        [orden, instante],
      ),
    }));

    expect(entrega).toEqual({ numero: `F-${anio}-0001`, conLaHoraFijada: true });
  });
});
