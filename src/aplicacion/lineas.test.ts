import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  validarCantidadDeLinea,
  validarLinea,
  validarLineaAQuitar,
  validarManoObra,
} from './lineas';

const ORDEN_ID = '9c1e7d52-0b3a-4f68-8a2d-6e4b1c7f3a90';
const RECAMBIO_ID = '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7b64';
const LINEA_ID = '5d2c8e1a-7b64-4f2b-8a4e-6c1d3e7a9b0f';

const ELIGE_RECAMBIO = 'Elige un recambio';
const CANTIDAD_FUERA = 'La cantidad va de 1 a 999';
const MINUTOS_FUERA = 'Los minutos van de 0 a 6000';
const SIN_ORDEN = 'No encontramos esa orden';
const SIN_LINEA = 'No encontramos ese recambio en la orden';

const IDS_BASURA: [string, unknown][] = [
  ['vacío', ''],
  ['sin formato de uuid', 'no-es-un-uuid'],
  ['con una cifra de más', `${ORDEN_ID}0`],
  ['un número', 7],
  ['nulo', null],
  ['ausente', undefined],
  ['una lista', [ORDEN_ID]],
];

const fallo = (errores: Record<string, string>) => ({ ok: false, errores });

describe('validarLinea', () => {
  it.each([
    ['un número', 3, 3],
    ['un texto de cifras', '3', 3],
    ['un texto con espacios', ' 12 ', 12],
    ['el mínimo', 1, 1],
    ['el máximo', 999, 999],
  ])('acepta la cantidad como %s', (_nombre, escrita, cantidad) => {
    const resultado = validarLinea({
      ordenId: ORDEN_ID,
      recambioId: RECAMBIO_ID,
      cantidad: escrita,
    });

    expect(resultado).toEqual({
      ok: true,
      datos: { ordenId: ORDEN_ID, recambioId: RECAMBIO_ID, cantidad },
    });
  });

  it.each([
    ['cero', 0],
    ['mil', 1000],
    ['negativa', -1],
    ['con decimales', 1.5],
    ['un texto con decimales', '1.5'],
    ['un texto con letras', 'abc'],
    ['vacía', ''],
    ['nula', null],
    ['verdadero', true],
    ['una lista', [3]],
    ['un texto enorme de cifras', '9'.repeat(400)],
  ])('[D-2] rechaza la cantidad %s', (_nombre, cantidad) => {
    const resultado = validarLinea({ ordenId: ORDEN_ID, recambioId: RECAMBIO_ID, cantidad });

    expect(resultado).toEqual(fallo({ cantidad: CANTIDAD_FUERA }));
  });

});

describe('validarLinea: el recambio y la orden', () => {
  it.each([
    ['vacío', ''],
    ['sin formato de uuid', 'no-es-un-uuid'],
    ['un número', 7],
    ['nulo', null],
  ])('[D-2] pide elegir recambio si el identificador es %s', (_nombre, recambioId) => {
    expect(validarLinea({ ordenId: ORDEN_ID, recambioId, cantidad: 2 })).toEqual(
      fallo({ recambioId: ELIGE_RECAMBIO }),
    );
  });

  it('[D-2] explica a la vez el recambio y la cantidad', () => {
    expect(validarLinea({ ordenId: ORDEN_ID, cantidad: 0 })).toEqual(
      fallo({ recambioId: ELIGE_RECAMBIO, cantidad: CANTIDAD_FUERA }),
    );
  });

  it.each(IDS_BASURA)('[D-2] la orden con un id %s no existe', (_nombre, ordenId) => {
    expect(validarLinea({ ordenId, recambioId: RECAMBIO_ID, cantidad: 2 })).toEqual(
      fallo({ ordenId: SIN_ORDEN }),
    );
  });
});

describe('validarManoObra', () => {
  it.each([
    ['cero', 0, 0],
    ['un número', 90, 90],
    ['un texto de cifras', '90', 90],
    ['el máximo', 6000, 6000],
  ])('acepta %s minutos', (_nombre, escritos, minutos) => {
    expect(validarManoObra({ ordenId: ORDEN_ID, minutos: escritos })).toEqual({
      ok: true,
      ordenId: ORDEN_ID,
      minutos,
    });
  });

  it.each([
    ['más del máximo', 6001],
    ['siete mil', 7000],
    ['negativos', -1],
    ['con decimales', 1.5],
    ['letras', 'abc'],
    ['vacíos', ''],
    ['ausentes', undefined],
  ])('[D-2] rechaza minutos %s', (_nombre, minutos) => {
    expect(validarManoObra({ ordenId: ORDEN_ID, minutos })).toEqual(
      fallo({ minutos: MINUTOS_FUERA }),
    );
  });

  it.each(IDS_BASURA)('[D-2] la orden con un id %s no existe', (_nombre, ordenId) => {
    expect(validarManoObra({ ordenId, minutos: 30 })).toEqual(fallo({ ordenId: SIN_ORDEN }));
  });
});

describe('validarCantidadDeLinea', () => {
  it.each([
    ['un número', 3, 3],
    ['un texto de cifras', '3', 3],
    ['el máximo', 999, 999],
  ])('[C-5] acepta la cantidad como %s', (_nombre, escrita, cantidad) => {
    expect(validarCantidadDeLinea({ lineaId: LINEA_ID, cantidad: escrita })).toEqual({
      ok: true,
      datos: { lineaId: LINEA_ID, cantidad },
    });
  });

  it.each([0, 1000, -1, 1.5, 'abc', '', null, undefined])(
    '[D-2] rechaza la cantidad %j',
    (cantidad) => {
      expect(validarCantidadDeLinea({ lineaId: LINEA_ID, cantidad })).toEqual(
        fallo({ cantidad: CANTIDAD_FUERA }),
      );
    },
  );

  it.each(IDS_BASURA)('[D-2] la línea con un id %s no existe', (_nombre, lineaId) => {
    expect(validarCantidadDeLinea({ lineaId, cantidad: 2 })).toEqual(
      fallo({ lineaId: SIN_LINEA }),
    );
  });
});

describe('validarLineaAQuitar', () => {
  it('acepta el id de una línea', () => {
    expect(validarLineaAQuitar({ lineaId: LINEA_ID })).toEqual({
      ok: true,
      datos: { lineaId: LINEA_ID },
    });
  });

  it.each(IDS_BASURA)('[D-2] la línea con un id %s no existe', (_nombre, lineaId) => {
    expect(validarLineaAQuitar({ lineaId })).toEqual(fallo({ lineaId: SIN_LINEA }));
  });
});

describe('los validadores de líneas, entrada basura', () => {
  it('[D-2] valida líneas y mano de obra', () => {
    const resultados = [
      validarLinea({ ordenId: ORDEN_ID, recambioId: RECAMBIO_ID, cantidad: 0 }),
      validarManoObra({ ordenId: ORDEN_ID, minutos: 7000 }),
      validarManoObra({ ordenId: ORDEN_ID, minutos: 'abc' }),
    ];

    expect(resultados.map(({ ok }) => ok)).toEqual([false, false, false]);
  });

  it.each([
    ['null', null],
    ['un texto', 'x'],
    ['un número', 5],
    ['una lista', [1]],
  ])('[D-2] una entrada que no es un objeto (%s) se rechaza', (_nombre, entrada) => {
    expect(validarLinea(entrada).ok).toBe(false);
    expect(validarCantidadDeLinea(entrada).ok).toBe(false);
    expect(validarLineaAQuitar(entrada)).toEqual(fallo({ lineaId: SIN_LINEA }));
    expect(validarManoObra(entrada)).toEqual(
      fallo({ ordenId: SIN_ORDEN, minutos: MINUTOS_FUERA }),
    );
  });

  it('[D-2] ninguna entrada hace lanzar a los validadores', () => {
    fc.assert(
      fc.property(fc.anything(), (entrada) => {
        expect(typeof validarLinea(entrada).ok).toBe('boolean');
        expect(typeof validarManoObra(entrada).ok).toBe('boolean');
        expect(typeof validarCantidadDeLinea(entrada).ok).toBe('boolean');
        expect(typeof validarLineaAQuitar(entrada).ok).toBe('boolean');
      }),
    );
  });

  it('[D-2] una cantidad entera de 1 a 999 siempre se acepta y fuera de ese rango nunca', () => {
    fc.assert(
      fc.property(fc.integer({ min: -2000, max: 2000 }), (cantidad) => {
        const enUnaLinea = validarLinea({ ordenId: ORDEN_ID, recambioId: RECAMBIO_ID, cantidad });
        const enSuLinea = validarCantidadDeLinea({ lineaId: LINEA_ID, cantidad });

        expect([enUnaLinea.ok, enSuLinea.ok]).toEqual(Array(2).fill(cantidad >= 1 && cantidad <= 999));
      }),
    );
  });
});
