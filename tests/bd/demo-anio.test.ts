import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { crearBd } from './arnes';

const VEGA = '00000000-0000-4000-8000-00000000000a';

// PGlite lee el reloj de Node: con la fecha falsa, now() dentro de Postgres es esa fecha.
const bd = await crearBd();

afterAll(() => bd.cerrar());
afterEach(() => vi.useRealTimers());

// [cuándo, instante, año de Madrid en ese instante]
const MOMENTOS = [
  [
    'a principios de año, con seis días atrás en el año anterior',
    '2027-01-03T10:00:00+01:00',
    '2027',
  ],
  ['con el año nuevo ya en Madrid pero todavía no en UTC', '2026-12-31T23:30:00Z', '2027'],
  ['a mitad de año', '2027-07-15T12:00:00+02:00', '2027'],
  ['el último segundo del año en Madrid', '2027-12-31T22:59:59Z', '2027'],
  ['el primer instante del año siguiente en Madrid', '2027-12-31T23:00:00Z', '2028'],
] as const;

// Restablece la demo como si fuera `instante` y devuelve la factura de partida de Talleres Vega.
async function facturaDePartidaEn(instante: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(instante));
  // Sin fila de control no hay espera de 10 minutos que cumplir.
  await bd.sql('delete from public.demo_control');
  await bd.sql('select public.restablecer_demo()');
  const [factura] = await bd.sql(
    `select numero_factura,
            to_char(entregada_en at time zone 'Europe/Madrid', 'YYYY') as anio_de_entrega,
            (extract(epoch from entregada_en) * 1000)::float8 as entregada_ms,
            (extract(epoch from creada_en) * 1000)::float8 as creada_ms
       from public.ordenes
      where taller_id = $1 and estado = 'entregado'`,
    [VEGA],
  );
  return factura;
}

describe('factura de partida de la demo', () => {
  it.each(MOMENTOS)(
    '[C-13] %s el número lleva el año de Madrid',
    async (_cuando, instante, anio) => {
      const factura = await facturaDePartidaEn(instante);

      expect(factura.numero_factura).toBe(`F-${anio}-0001`);
    },
  );

  it.each(MOMENTOS)(
    '[C-13] %s la fecha de entrega cae en ese mismo año',
    async (_cuando, instante, anio) => {
      const factura = await facturaDePartidaEn(instante);

      expect(factura.anio_de_entrega).toBe(anio);
    },
  );

  it.each(MOMENTOS)(
    '[C-13] %s se entregó después de crearse y no en el futuro',
    async (_cuando, instante) => {
      const factura = await facturaDePartidaEn(instante);

      expect(factura.entregada_ms).toBeLessThanOrEqual(Date.parse(instante));
      expect(factura.entregada_ms).toBeGreaterThanOrEqual(Number(factura.creada_ms));
    },
  );
});
