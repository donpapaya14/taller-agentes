import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validarLinea, validarManoObra } from './lineas';

const RECAMBIO_ID = '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7b64';

const ELIGE_RECAMBIO = 'Elige un recambio';
const CANTIDAD_FUERA = 'La cantidad va de 1 a 999';
const MINUTOS_FUERA = 'Los minutos van de 0 a 6000';

const fallo = (errores: Record<string, string>) => ({ ok: false, errores });

describe('validarLinea', () => {
  it.each([
    ['un número', 3, 3],
    ['un texto de cifras', '3', 3],
    ['un texto con espacios', ' 12 ', 12],
    ['el mínimo', 1, 1],
    ['el máximo', 999, 999],
  ])('acepta la cantidad como %s', (_nombre, escrita, cantidad) => {
    const resultado = validarLinea({ recambioId: RECAMBIO_ID, cantidad: escrita });

    expect(resultado).toEqual({ ok: true, datos: { recambioId: RECAMBIO_ID, cantidad } });
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
    const resultado = validarLinea({ recambioId: RECAMBIO_ID, cantidad });

    expect(resultado).toEqual(fallo({ cantidad: CANTIDAD_FUERA }));
  });

  it.each([
    ['vacío', ''],
    ['sin formato de uuid', 'no-es-un-uuid'],
    ['un número', 7],
    ['nulo', null],
  ])('[D-2] pide elegir recambio si el identificador es %s', (_nombre, recambioId) => {
    expect(validarLinea({ recambioId, cantidad: 2 })).toEqual(
      fallo({ recambioId: ELIGE_RECAMBIO }),
    );
  });

  it('[D-2] explica a la vez el recambio y la cantidad', () => {
    expect(validarLinea({ cantidad: 0 })).toEqual(
      fallo({ recambioId: ELIGE_RECAMBIO, cantidad: CANTIDAD_FUERA }),
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
    expect(validarManoObra({ minutos: escritos })).toEqual({ ok: true, minutos });
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
    expect(validarManoObra({ minutos })).toEqual(fallo({ minutos: MINUTOS_FUERA }));
  });
});

describe('validarLinea y validarManoObra, entrada basura', () => {
  it('[D-2] valida líneas y mano de obra', () => {
    const resultados = [
      validarLinea({ recambioId: RECAMBIO_ID, cantidad: 0 }),
      validarManoObra({ minutos: 7000 }),
      validarManoObra({ minutos: 'abc' }),
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
    expect(validarManoObra(entrada)).toEqual(fallo({ minutos: MINUTOS_FUERA }));
  });

  it('[D-2] ninguna entrada hace lanzar a los validadores', () => {
    fc.assert(
      fc.property(fc.anything(), (entrada) => {
        expect(typeof validarLinea(entrada).ok).toBe('boolean');
        expect(typeof validarManoObra(entrada).ok).toBe('boolean');
      }),
    );
  });

  it('[D-2] una cantidad entera de 1 a 999 siempre se acepta y fuera de ese rango nunca', () => {
    fc.assert(
      fc.property(fc.integer({ min: -2000, max: 2000 }), (cantidad) => {
        const { ok } = validarLinea({ recambioId: RECAMBIO_ID, cantidad });

        expect(ok).toBe(cantidad >= 1 && cantidad <= 999);
      }),
    );
  });
});
