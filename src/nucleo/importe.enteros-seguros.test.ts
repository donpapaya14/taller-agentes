import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calcularTotales, formatearEuros, type Linea } from './importe';

// Por encima de 2^53 - 1 un número ya no es exacto: el dinero lo rechaza en vez de perder céntimos.
const MAYOR_SEGURO = Number.MAX_SAFE_INTEGER;

const MENSAJE_DE_ERROR = 'Importe no válido';

const lineaDe = (cantidad: number, precioUnitarioCentimos: number): Linea => ({
  cantidad,
  precioUnitarioCentimos,
});

const CENTIMOS_NO_VALIDOS = [
  { caso: 'con decimales', centimos: 12.5 },
  { caso: 'que no es un número', centimos: Number.NaN },
  { caso: 'infinito', centimos: Number.POSITIVE_INFINITY },
  { caso: 'infinito negativo', centimos: Number.NEGATIVE_INFINITY },
  { caso: 'por encima del mayor entero seguro', centimos: MAYOR_SEGURO + 1 },
  { caso: 'por debajo del menor entero seguro', centimos: -MAYOR_SEGURO - 1 },
];

// Todas las entradas son válidas una a una: lo que no cabe es un resultado intermedio.
const CALCULOS_QUE_NO_CABEN = [
  {
    caso: 'una línea cuyo importe (cantidad × precio) no cabe',
    lineas: [lineaDe(2 ** 30 + 1, 2 ** 30 - 1)],
    minutos: 0,
    precioHora: 0,
  },
  {
    caso: 'varias líneas que juntas no caben',
    lineas: [
      lineaDe(1, 4_000_000_000_000_000),
      lineaDe(1, 4_000_000_000_000_000),
      lineaDe(1, 4_000_000_000_000_000),
    ],
    minutos: 0,
    precioHora: 0,
  },
  {
    caso: 'una mano de obra (minutos × precio por hora) que no cabe',
    lineas: [],
    minutos: 2 ** 27 + 1,
    precioHora: 2 ** 27 - 1,
  },
  {
    caso: 'recambios y mano de obra que juntos no caben',
    lineas: [lineaDe(1, MAYOR_SEGURO - 5)],
    minutos: 60,
    precioHora: 100,
  },
  {
    caso: 'un IVA que saldría de un producto inexacto, aunque el total quepa',
    lineas: [lineaDe(1, 500_000_000_000_001)],
    minutos: 0,
    precioHora: 0,
  },
  {
    caso: 'un total que no cabe',
    lineas: [lineaDe(1, MAYOR_SEGURO)],
    minutos: 0,
    precioHora: 0,
  },
];

// Números de todos los tamaños: de unos céntimos a casi el mayor entero seguro.
const importeDeCualquierTamano = fc
  .integer({ min: 0, max: 52 })
  .chain((bits) => fc.integer({ min: 0, max: 2 ** bits }));

const lineaDeCualquierTamano = fc.record({
  cantidad: importeDeCualquierTamano.map((cantidad) => cantidad + 1),
  precioUnitarioCentimos: importeDeCualquierTamano,
});

const numeroCualquiera = fc.oneof(fc.maxSafeInteger(), fc.integer(), fc.double());

const FORMATO_DE_EUROS = /^-?\d{1,3}(\.\d{3})*,\d{2} €$/;

// '-1.234,56 €' → -123456 como bigint, para compararlo con el número exacto sin pasar por un float.
const centimosDelTexto = (texto: string): bigint =>
  BigInt(texto.replace(' €', '').replace(',', '').replaceAll('.', ''));

// El objetivo de TypeScript es ES2017: sin literales como 60n, los bigint se crean con BigInt().
const MINUTOS_POR_HORA = BigInt(60);
const IVA_PORCENTAJE = BigInt(21);
const CIEN = BigInt(100);

// Cociente al entero más cercano, con la mitad hacia arriba (todo es positivo), como Math.round.
const dividirRedondeando = (dividendo: bigint, divisor: bigint): bigint =>
  (dividendo + divisor / BigInt(2)) / divisor;

// El mismo cálculo sin límite de tamaño, con todos los números por los que pasa.
function calculoExacto(lineas: Linea[], minutos: number, precioHora: number) {
  const productos = lineas.map(
    (linea) => BigInt(linea.cantidad) * BigInt(linea.precioUnitarioCentimos),
  );
  const recambios = productos.reduce((suma, producto) => suma + producto, BigInt(0));
  const productoManoObra = BigInt(minutos) * BigInt(precioHora);
  const manoObra = dividirRedondeando(productoManoObra, MINUTOS_POR_HORA);
  const base = recambios + manoObra;
  const productoIva = base * IVA_PORCENTAJE;
  const iva = dividirRedondeando(productoIva, CIEN);
  const total = base + iva;

  return {
    totales: {
      recambiosCentimos: Number(recambios),
      manoObraCentimos: Number(manoObra),
      baseCentimos: Number(base),
      ivaCentimos: Number(iva),
      totalCentimos: Number(total),
    },
    pasos: [...productos, recambios, productoManoObra, base, productoIva, total],
  };
}

describe('importe: formatear solo enteros seguros', () => {
  it.each(CENTIMOS_NO_VALIDOS)(
    '[C-7][D-5] formatearEuros rechaza un importe $caso',
    ({ centimos }) => {
      expect(() => formatearEuros(centimos)).toThrow(new RangeError(MENSAJE_DE_ERROR));
    },
  );

  it('[C-7][D-5] formatearEuros llega hasta el mayor entero seguro, con los dos signos', () => {
    expect(formatearEuros(MAYOR_SEGURO)).toBe('90.071.992.547.409,91 €');
    expect(formatearEuros(-MAYOR_SEGURO)).toBe('-90.071.992.547.409,91 €');
  });

  it('[C-7][D-5] formatearEuros no pierde céntimos con un entero seguro y rechaza lo demás', () => {
    fc.assert(
      fc.property(numeroCualquiera, (numero) => {
        if (Number.isSafeInteger(numero)) {
          const texto = formatearEuros(numero);

          expect(texto).toMatch(FORMATO_DE_EUROS);
          expect(centimosDelTexto(texto)).toBe(BigInt(numero));
        } else {
          expect(() => formatearEuros(numero)).toThrow(new RangeError(MENSAJE_DE_ERROR));
        }
      }),
    );
  });
});

describe('importe: totales que no caben', () => {
  it.each(CALCULOS_QUE_NO_CABEN)(
    '[C-7][D-5] calcularTotales rechaza $caso',
    ({ lineas, minutos, precioHora }) => {
      const calcular = () => calcularTotales(lineas, minutos, precioHora);

      expect(calcular).toThrow(new RangeError(MENSAJE_DE_ERROR));
    },
  );

  it('[C-7][D-5] la mayor base cuyo IVA se calcula sin perder céntimos se acepta', () => {
    const totales = calcularTotales([lineaDe(1, 428_914_250_225_761)], 0, 0);

    expect(totales).toEqual({
      recambiosCentimos: 428_914_250_225_761,
      manoObraCentimos: 0,
      baseCentimos: 428_914_250_225_761,
      ivaCentimos: 90_071_992_547_410,
      totalCentimos: 518_986_242_773_171,
    });
  });

  it('[C-7][D-5] con un céntimo más de base el IVA ya no cabe', () => {
    const calcular = () => calcularTotales([lineaDe(1, 428_914_250_225_762)], 0, 0);

    expect(calcular).toThrow(new RangeError(MENSAJE_DE_ERROR));
  });
});

describe('importe: totales exactos o rechazados', () => {
  it('[C-7][D-5] devuelve los céntimos exactos, o rechaza si algún paso del cálculo no cabe', () => {
    let huboResultado = false;
    let huboRechazo = false;

    fc.assert(
      fc.property(
        fc.array(lineaDeCualquierTamano, { maxLength: 3 }),
        importeDeCualquierTamano,
        importeDeCualquierTamano,
        (lineas, minutos, precioHora) => {
          const { totales, pasos } = calculoExacto(lineas, minutos, precioHora);
          const calcular = () => calcularTotales(lineas, minutos, precioHora);

          if (pasos.every((paso) => paso <= BigInt(MAYOR_SEGURO))) {
            huboResultado = true;
            expect(calcular()).toEqual(totales);
          } else {
            huboRechazo = true;
            expect(calcular).toThrow(new RangeError(MENSAJE_DE_ERROR));
          }
        },
      ),
    );

    // Un generador que nunca llegara a una de las dos ramas no probaría nada.
    expect(huboResultado).toBe(true);
    expect(huboRechazo).toBe(true);
  });
});
