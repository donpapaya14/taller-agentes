import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  calcularTotales,
  eurosACentimos,
  formatearEuros,
  IVA_PORCENTAJE,
  type Linea,
  type Totales,
} from './importe';

const MENSAJE_DE_ERROR = 'Importe no válido';

const LINEA_BUENA: Linea = { cantidad: 1, precioUnitarioCentimos: 1000 };

const unaLinea = (precioUnitarioCentimos: number): Linea[] => [
  { cantidad: 1, precioUnitarioCentimos },
];

const lineaArbitraria = fc.record({
  cantidad: fc.integer({ min: 1, max: 50 }),
  precioUnitarioCentimos: fc.integer({ min: 0, max: 500_000 }),
});

const centimosArbitrarios = fc.integer({ min: 0, max: 1_000_000_000_000 });

const sumaDeRecambios = (lineas: Linea[]): number =>
  lineas.reduce((suma, linea) => suma + linea.cantidad * linea.precioUnitarioCentimos, 0);

const CASOS_NO_VALIDOS = [
  { caso: 'precio con decimales', lineas: unaLinea(12.5), minutos: 0, precioHora: 0 },
  { caso: 'precio negativo', lineas: unaLinea(-1), minutos: 0, precioHora: 0 },
  { caso: 'precio que no es un número', lineas: unaLinea(Number.NaN), minutos: 0, precioHora: 0 },
  {
    caso: 'precio fuera de los enteros seguros',
    lineas: unaLinea(2 ** 53),
    minutos: 0,
    precioHora: 0,
  },
  {
    caso: 'cantidad negativa',
    lineas: [{ cantidad: -1, precioUnitarioCentimos: 100 }],
    minutos: 0,
    precioHora: 0,
  },
  {
    caso: 'cantidad cero',
    lineas: [{ cantidad: 0, precioUnitarioCentimos: 100 }],
    minutos: 0,
    precioHora: 0,
  },
  {
    caso: 'cantidad con decimales',
    lineas: [{ cantidad: 1.5, precioUnitarioCentimos: 100 }],
    minutos: 0,
    precioHora: 0,
  },
  {
    caso: 'una línea mala detrás de una buena',
    lineas: [LINEA_BUENA, { cantidad: 0, precioUnitarioCentimos: 100 }],
    minutos: 0,
    precioHora: 0,
  },
  { caso: 'minutos con decimales', lineas: [], minutos: 1.5, precioHora: 4500 },
  { caso: 'minutos negativos', lineas: [], minutos: -1, precioHora: 4500 },
  { caso: 'minutos infinitos', lineas: [], minutos: Number.POSITIVE_INFINITY, precioHora: 4500 },
  { caso: 'precio por hora con decimales', lineas: [], minutos: 60, precioHora: 45.5 },
  { caso: 'precio por hora negativo', lineas: [], minutos: 60, precioHora: -1 },
];

const CASOS_DE_REDONDEO = [
  {
    caso: 'la mano de obra de 0,5 céntimos sube a 1',
    lineas: [],
    minutos: 1,
    precioHora: 30,
    esperado: { manoObraCentimos: 1, ivaCentimos: 0 },
  },
  {
    caso: 'la mano de obra de 0,48 céntimos baja a 0',
    lineas: [],
    minutos: 1,
    precioHora: 29,
    esperado: { manoObraCentimos: 0, ivaCentimos: 0 },
  },
  {
    caso: 'el IVA de 10,5 céntimos sube a 11',
    lineas: unaLinea(50),
    minutos: 0,
    precioHora: 0,
    esperado: { manoObraCentimos: 0, ivaCentimos: 11 },
  },
  {
    caso: 'el IVA de 10,29 céntimos baja a 10',
    lineas: unaLinea(49),
    minutos: 0,
    precioHora: 0,
    esperado: { manoObraCentimos: 0, ivaCentimos: 10 },
  },
  {
    caso: 'el IVA de 10,71 céntimos sube a 11',
    lineas: unaLinea(51),
    minutos: 0,
    precioHora: 0,
    esperado: { manoObraCentimos: 0, ivaCentimos: 11 },
  },
];

const CASOS_DE_FORMATO = [
  { centimos: 123456, texto: '1.234,56 €' },
  { centimos: 5, texto: '0,05 €' },
  { centimos: 0, texto: '0,00 €' },
  { centimos: 100000000, texto: '1.000.000,00 €' },
  { centimos: -50, texto: '-0,50 €' },
  { centimos: 99, texto: '0,99 €' },
  { centimos: 100, texto: '1,00 €' },
  { centimos: 99999, texto: '999,99 €' },
  { centimos: 100000, texto: '1.000,00 €' },
  { centimos: 1234500, texto: '12.345,00 €' },
  { centimos: 12345600, texto: '123.456,00 €' },
  { centimos: -123456, texto: '-1.234,56 €' },
];

const CASOS_DE_EUROS_ESCRITOS = [
  { texto: '12,50', centimos: 1250 },
  { texto: '12.5', centimos: 1250 },
  { texto: '0,1', centimos: 10 },
  { texto: '12,505', centimos: null },
  { texto: 'abc', centimos: null },
  { texto: '-1', centimos: null },
  { texto: '12', centimos: 1200 },
  { texto: '0', centimos: 0 },
  { texto: '0,05', centimos: 5 },
  { texto: '1234,56', centimos: 123456 },
  { texto: '007,5', centimos: 750 },
  { texto: '', centimos: null },
  { texto: ',5', centimos: null },
  { texto: '12,', centimos: null },
  { texto: '1,2,3', centimos: null },
  { texto: '12 €', centimos: null },
  { texto: '99999999999999999999', centimos: null },
];

describe('importe: totales', () => {
  it('[C-7][D-5] base + IVA = total y todo son enteros', () => {
    fc.assert(
      fc.property(
        fc.array(lineaArbitraria, { maxLength: 8 }),
        fc.integer({ min: 0, max: 2000 }),
        fc.integer({ min: 0, max: 20_000 }),
        (lineas, minutos, precioHora) => {
          const totales = calcularTotales(lineas, minutos, precioHora);

          for (const valor of Object.values(totales)) {
            expect(Number.isInteger(valor)).toBe(true);
          }
          expect(totales.recambiosCentimos).toBe(sumaDeRecambios(lineas));
          expect(totales.manoObraCentimos).toBe(Math.round((minutos * precioHora) / 60));
          expect(totales.baseCentimos).toBe(totales.recambiosCentimos + totales.manoObraCentimos);
          expect(totales.ivaCentimos).toBe(Math.round((totales.baseCentimos * 21) / 100));
          expect(totales.totalCentimos).toBe(totales.baseCentimos + totales.ivaCentimos);
        },
      ),
    );
  });

  it('[C-7] ejemplo fijado', () => {
    const lineas: Linea[] = [
      { cantidad: 2, precioUnitarioCentimos: 1250 },
      { cantidad: 1, precioUnitarioCentimos: 899 },
    ];
    const esperado: Totales = {
      recambiosCentimos: 3399,
      manoObraCentimos: 6750,
      baseCentimos: 10149,
      ivaCentimos: 2131,
      totalCentimos: 12280,
    };

    expect(calcularTotales(lineas, 90, 4500)).toEqual(esperado);
  });

  it('[C-7] el IVA es el 21 %', () => {
    expect(IVA_PORCENTAJE).toBe(21);
  });
});

describe('importe: redondeo y ceros', () => {
  it.each(CASOS_DE_REDONDEO)('[C-7] redondea al céntimo: $caso', (caso) => {
    const totales = calcularTotales(caso.lineas, caso.minutos, caso.precioHora);

    expect(totales).toMatchObject(caso.esperado);
  });

  it('[C-7] sin líneas ni mano de obra todo es cero, y el cero es un importe válido', () => {
    const ceros: Totales = {
      recambiosCentimos: 0,
      manoObraCentimos: 0,
      baseCentimos: 0,
      ivaCentimos: 0,
      totalCentimos: 0,
    };

    expect(calcularTotales([], 0, 0)).toEqual(ceros);
    expect(calcularTotales([{ cantidad: 3, precioUnitarioCentimos: 0 }], 0, 0)).toEqual(ceros);
  });
});

describe('importe: entradas no válidas', () => {
  it.each(CASOS_NO_VALIDOS)(
    '[C-7][D-5] rechaza decimales, negativos y cantidad cero: $caso',
    ({ lineas, minutos, precioHora }) => {
      const calcular = () => calcularTotales(lineas, minutos, precioHora);

      expect(calcular).toThrow(new RangeError(MENSAJE_DE_ERROR));
    },
  );
});

describe('importe: euros con formato', () => {
  it.each(CASOS_DE_FORMATO)('[C-7] formatea euros: $centimos', ({ centimos, texto }) => {
    expect(formatearEuros(centimos)).toBe(texto);
  });

  it('[C-7] el espacio antes del euro es un espacio normal que el PDF sabe dibujar', () => {
    expect(formatearEuros(100)).toBe('1,00 €');
  });

  it('[C-7][D-5] los miles van de tres en tres con punto y los céntimos con dos cifras', () => {
    fc.assert(
      fc.property(centimosArbitrarios, (centimos) => {
        expect(formatearEuros(centimos)).toMatch(/^\d{1,3}(\.\d{3})*,\d{2} €$/);
      }),
    );
  });

  it('[C-7] un importe negativo lleva el signo delante', () => {
    fc.assert(
      fc.property(centimosArbitrarios, (centimos) => {
        fc.pre(centimos > 0);
        expect(formatearEuros(-centimos)).toBe(`-${formatearEuros(centimos)}`);
      }),
    );
  });
});

describe('importe: euros escritos', () => {
  it.each(CASOS_DE_EUROS_ESCRITOS)(
    '[C-7][D-5] convierte euros escritos a céntimos: "$texto"',
    ({ texto, centimos }) => {
      expect(eurosACentimos(texto)).toBe(centimos);
    },
  );

  it('[C-7][D-5] un importe con dos decimales vuelve a sus céntimos con coma o con punto', () => {
    fc.assert(
      fc.property(centimosArbitrarios, fc.constantFrom(',', '.'), (centimos, separador) => {
        const euros = Math.floor(centimos / 100);
        const resto = String(centimos % 100).padStart(2, '0');

        expect(eurosACentimos(`${euros}${separador}${resto}`)).toBe(centimos);
      }),
    );
  });

  it('[C-7][D-5] formatear y volver a leer devuelve los mismos céntimos', () => {
    fc.assert(
      fc.property(centimosArbitrarios, (centimos) => {
        const sinMiles = formatearEuros(centimos).replace(' €', '').replaceAll('.', '');

        expect(eurosACentimos(sinMiles)).toBe(centimos);
      }),
    );
  });
});
