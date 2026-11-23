import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  bajoMinimo,
  descontar,
  type Consumo,
  type Existencia,
  type ResultadoDescuento,
} from './stock';

const FILTRO: Existencia = { recambioId: 'r-1', referencia: 'FIL-01', stock: 2, stockMinimo: 1 };
const PASTILLAS: Existencia = {
  recambioId: 'r-2',
  referencia: 'PAS-02',
  stock: 10,
  stockMinimo: 4,
};

const IDS_EN_ALMACEN = ['a', 'b', 'c'];

const consumo = (recambioId: string, cantidad: number): Consumo => ({ recambioId, cantidad });

const existenciasArbitrarias = fc.uniqueArray(
  fc.record({
    recambioId: fc.constantFrom(...IDS_EN_ALMACEN),
    referencia: fc.string({ minLength: 1, maxLength: 5 }),
    stock: fc.integer({ min: 0, max: 20 }),
    stockMinimo: fc.integer({ min: 0, max: 5 }),
  }),
  { selector: (existencia) => existencia.recambioId, maxLength: IDS_EN_ALMACEN.length },
);

// Casi siempre piden recambios del almacén; de vez en cuando uno que no existe.
const consumosArbitrarios = fc.array(
  fc.record({
    recambioId: fc.oneof(
      { weight: 9, arbitrary: fc.constantFrom(...IDS_EN_ALMACEN) },
      { weight: 1, arbitrary: fc.constant('sin-existir') },
    ),
    cantidad: fc.integer({ min: 1, max: 8 }),
  }),
  { maxLength: 4 },
);

const pedidoDe = (consumos: Consumo[], recambioId: string): number =>
  consumos
    .filter((pedido) => pedido.recambioId === recambioId)
    .reduce((suma, pedido) => suma + pedido.cantidad, 0);

function alcanzaElStock(existencias: Existencia[], consumos: Consumo[]): boolean {
  return consumos.every(({ recambioId }) => {
    const existencia = existencias.find((candidata) => candidata.recambioId === recambioId);
    return existencia !== undefined && existencia.stock >= pedidoDe(consumos, recambioId);
  });
}

function comprobarDescuento(antes: Existencia[], consumos: Consumo[], despues: Existencia[]): void {
  expect(despues).toHaveLength(antes.length);
  antes.forEach((existencia, posicion) => {
    const nueva = despues[posicion];

    expect(nueva.stock).toBeGreaterThanOrEqual(0);
    expect(existencia.stock - nueva.stock).toBe(pedidoDe(consumos, existencia.recambioId));
    expect({ ...nueva, stock: existencia.stock }).toEqual(existencia);
  });
}

describe('stock: descontar con propiedades', () => {
  it('[C-5] descontar es todo o nada', () => {
    let huboDescuento = false;
    let huboFalta = false;

    fc.assert(
      fc.property(existenciasArbitrarias, consumosArbitrarios, (existencias, consumos) => {
        const copia = structuredClone(existencias);
        const resultado = descontar(existencias, consumos);

        expect(existencias).toEqual(copia);
        expect(resultado.ok).toBe(alcanzaElStock(existencias, consumos));
        if (resultado.ok) {
          huboDescuento = true;
          comprobarDescuento(existencias, consumos, resultado.existencias);
        } else {
          huboFalta = true;
          expect(resultado.faltan.length).toBeGreaterThan(0);
        }
      }),
    );

    // Un generador que nunca llegara a una de las dos ramas no probaría nada.
    expect(huboDescuento).toBe(true);
    expect(huboFalta).toBe(true);
  });
});

describe('stock: descontar con ejemplos', () => {
  it('[C-5] nombra la referencia que falta y cuánto', () => {
    const esperado: ResultadoDescuento = {
      ok: false,
      faltan: [{ referencia: 'FIL-01', falta: 3 }],
    };

    expect(descontar([FILTRO], [consumo('r-1', 5)])).toEqual(esperado);
  });

  it('[C-5] resta lo consumido y deja el resto como estaba', () => {
    const resultado = descontar([FILTRO, PASTILLAS], [consumo('r-2', 4)]);

    expect(resultado).toEqual({ ok: true, existencias: [FILTRO, { ...PASTILLAS, stock: 6 }] });
  });

  it('[C-5] se puede gastar todo el stock', () => {
    const resultado = descontar([FILTRO], [consumo('r-1', 2)]);

    expect(resultado).toEqual({ ok: true, existencias: [{ ...FILTRO, stock: 0 }] });
  });

  it('[C-5] sin consumos las existencias quedan igual', () => {
    expect(descontar([FILTRO, PASTILLAS], [])).toEqual({
      ok: true,
      existencias: [FILTRO, PASTILLAS],
    });
  });

  it('[C-5] los consumos repetidos del mismo recambio se suman', () => {
    const cabe = descontar([PASTILLAS], [consumo('r-2', 3), consumo('r-2', 4)]);
    const sobra = descontar([PASTILLAS], [consumo('r-2', 6), consumo('r-2', 6)]);

    expect(cabe).toEqual({ ok: true, existencias: [{ ...PASTILLAS, stock: 3 }] });
    expect(sobra).toEqual({ ok: false, faltan: [{ referencia: 'PAS-02', falta: 2 }] });
  });

  it('[C-5] un recambio que no existe falta con la referencia ? y su id', () => {
    const resultado = descontar([FILTRO], [consumo('r-9', 4)]);

    expect(resultado).toEqual({ ok: false, faltan: [{ referencia: '?r-9', falta: 4 }] });
  });

  it('[C-5] los recambios que faltan salen en el orden en que se pidieron', () => {
    const faltanDe = (consumos: Consumo[]): string[] => {
      const resultado = descontar([FILTRO, PASTILLAS], consumos);
      return resultado.ok ? [] : resultado.faltan.map((falta) => falta.referencia);
    };

    expect(faltanDe([consumo('r-1', 5), consumo('r-2', 20)])).toEqual(['FIL-01', 'PAS-02']);
    expect(faltanDe([consumo('r-2', 20), consumo('r-1', 5)])).toEqual(['PAS-02', 'FIL-01']);
  });

  it('[C-5] no modifica las existencias que recibe, ni cuando descuenta ni cuando falta', () => {
    const existencias = [{ ...FILTRO }, { ...PASTILLAS }];

    descontar(existencias, [consumo('r-1', 1)]);
    descontar(existencias, [consumo('r-1', 9)]);

    expect(existencias).toEqual([FILTRO, PASTILLAS]);
  });
});

describe('stock: bajo mínimo', () => {
  const CASOS = [
    { stock: 4, stockMinimo: 4, esperado: true },
    { stock: 5, stockMinimo: 4, esperado: false },
    { stock: 0, stockMinimo: 0, esperado: true },
    { stock: 3, stockMinimo: 4, esperado: true },
  ];

  it.each(CASOS)(
    '[C-6] bajo mínimo incluye el igual: stock $stock con mínimo $stockMinimo',
    ({ stock, stockMinimo, esperado }) => {
      expect(bajoMinimo({ stock, stockMinimo })).toBe(esperado);
    },
  );

  it('[C-6] vale para una existencia entera', () => {
    expect(bajoMinimo(FILTRO)).toBe(false);
    expect(bajoMinimo({ ...FILTRO, stock: 1 })).toBe(true);
  });

  it('[C-6] con menos stock un recambio bajo mínimo sigue estándolo', () => {
    fc.assert(
      fc.property(fc.nat(50), fc.nat(50), fc.nat(50), (stock, stockMinimo, consumido) => {
        fc.pre(bajoMinimo({ stock, stockMinimo }));
        expect(bajoMinimo({ stock: Math.max(0, stock - consumido), stockMinimo })).toBe(true);
      }),
    );
  });
});
