import fc from 'fast-check';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { anchoDe, type Estilo, limpiar, lineasDe, recortarLineas, trocear } from './texto';

const pdf = await PDFDocument.create();
const fuente = await pdf.embedFont(StandardFonts.Helvetica);
const ESTILO: Estilo = { fuente, tamano: 10.5 };
const CARACTERES = fuente.getCharacterSet().map((punto) => String.fromCodePoint(punto));
const ADMITIDOS: ReadonlySet<string> = new Set(CARACTERES);

// Ancho de una columna estrecha: unas 20 letras. Cualquier palabra de más se corta.
const ANCHO = 120;

const SIN_ESPACIOS = CARACTERES.filter((caracter) => !/\s/u.test(caracter));
const palabraArbitraria = fc
  .array(fc.constantFrom(...SIN_ESPACIOS), { minLength: 1, maxLength: 300 })
  .map((letras) => letras.join(''));

describe('limpiar', () => {
  const CON_ACENTOS = 'María José'.normalize('NFC');

  it('[C-8] un acento escrito como carácter aparte sale unido a su letra', () => {
    const decompuesto = CON_ACENTOS.normalize('NFD');

    expect(decompuesto).toHaveLength(CON_ACENTOS.length + 2);
    expect(limpiar(ADMITIDOS, decompuesto)).toBe(CON_ACENTOS);
  });

  it('[C-8] el acento también se une a su letra si algo invisible los separaba', () => {
    expect(limpiar(ADMITIDOS, 'e‍́')).toBe('é');
  });

  it('[C-8] lo que Helvetica no dibuja sale como ? y los espacios raros como espacios', () => {
    expect(limpiar(ADMITIDOS, 'Łukasz 😀\tNowak\u0000')).toBe('?ukasz ? Nowak');
  });

  it('[C-8] con cualquier texto solo deja caracteres que Helvetica dibuja, y limpiar dos veces es limpiar una', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 80 }), (texto) => {
        const limpio = limpiar(ADMITIDOS, texto);

        expect(Array.from(limpio).every((caracter) => ADMITIDOS.has(caracter))).toBe(true);
        expect(limpiar(ADMITIDOS, limpio)).toBe(limpio);
      }),
    );
  });
});

describe('trocear', () => {
  it('[C-8] una palabra que cabe sale entera, también si llena justo el ancho', () => {
    expect(trocear('tuerca', ESTILO, ANCHO)).toEqual(['tuerca']);
    expect(trocear('tuerca', ESTILO, anchoDe('tuerca', ESTILO))).toEqual(['tuerca']);
  });

  it('[C-8] una palabra que no cabe se corta en trozos que caben, tan largos como se pueda', () => {
    fc.assert(
      fc.property(palabraArbitraria, (palabra) => {
        const trozos = trocear(palabra, ESTILO, ANCHO);

        expect(trozos.join('')).toBe(palabra);
        trozos.forEach((trozo, i) => {
          expect(trozo.length === 1 || anchoDe(trozo, ESTILO) <= ANCHO, trozo).toBe(true);
          if (i < trozos.length - 1) {
            expect(anchoDe(trozo + trozos[i + 1][0], ESTILO), trozo).toBeGreaterThan(ANCHO);
          }
        });
      }),
    );
  });

  it('[C-8] si ni una letra cabe, corta de letra en letra', () => {
    expect(trocear('tuerca', ESTILO, 1)).toEqual(['t', 'u', 'e', 'r', 'c', 'a']);
  });

  it('[C-8] una palabra vacía sale como un solo trozo vacío', () => {
    expect(trocear('', ESTILO, ANCHO)).toEqual(['']);
  });

  it('[C-8] una palabra de 200.000 letras se corta en menos de un segundo', () => {
    const palabra = 'M'.repeat(200_000);

    const inicio = performance.now();
    const trozos = trocear(palabra, ESTILO, ANCHO);
    const segundos = (performance.now() - inicio) / 1000;

    expect(trozos.join('')).toBe(palabra);
    expect(segundos).toBeLessThan(1);
  });
});

describe('lineasDe', () => {
  it('[C-8] cada salto de línea abre una línea y ninguna pasa del ancho', () => {
    const texto = `${'tuerca '.repeat(30)}\n${'W'.repeat(100)}\r\n\ny ${'i'.repeat(300)}`;

    const lineas = lineasDe(ADMITIDOS, texto, ESTILO, ANCHO);

    expect(lineas.length).toBeGreaterThan(8);
    expect(lineas).toContain('');
    for (const linea of lineas) {
      expect(anchoDe(linea, ESTILO), linea).toBeLessThanOrEqual(ANCHO);
    }
    expect(lineas.join('').replaceAll(' ', '')).toBe(texto.replace(/\s/gu, ''));
  });

  it('[C-8] una línea que llena justo el ancho no se parte', () => {
    expect(lineasDe(ADMITIDOS, 'uno dos', ESTILO, anchoDe('uno dos', ESTILO))).toEqual(['uno dos']);
  });

  it('[C-8] los espacios repetidos o de los bordes no dejan huecos', () => {
    expect(lineasDe(ADMITIDOS, '  uno   dos  ', ESTILO, ANCHO)).toEqual(['uno dos']);
  });

  it('[C-8] una palabra más ancha que la línea no deja una línea vacía delante', () => {
    const palabra = 'W'.repeat(100);

    expect(lineasDe(ADMITIDOS, palabra, ESTILO, ANCHO)).toEqual(trocear(palabra, ESTILO, ANCHO));
  });
});

describe('recortarLineas', () => {
  const LINEAS = ['uno', 'dos', 'tres', 'cuatro', 'cinco'];

  it('[C-8] con tantas líneas como el máximo no toca nada', () => {
    expect(recortarLineas(LINEAS.slice(0, 3), 3, ESTILO, ANCHO)).toEqual(['uno', 'dos', 'tres']);
  });

  it('[C-8] con más líneas que el máximo deja el máximo y cierra la última con puntos suspensivos', () => {
    expect(recortarLineas(LINEAS, 3, ESTILO, ANCHO)).toEqual(['uno', 'dos', 'tres…']);
  });

  it('[C-8] los puntos suspensivos caben en el ancho aunque la última línea lo llene', () => {
    const llena = lineasDe(ADMITIDOS, 'M'.repeat(100), ESTILO, ANCHO);

    const recortadas = recortarLineas(llena, 2, ESTILO, ANCHO);

    expect(recortadas).toHaveLength(2);
    expect(recortadas[1].endsWith('…')).toBe(true);
    expect(anchoDe(recortadas[1], ESTILO)).toBeLessThanOrEqual(ANCHO);
    expect(recortadas[1]).not.toBe(`${llena[1]}…`);
  });

  it('[C-8] no deja un espacio delante de los puntos suspensivos', () => {
    const ancho = anchoDe('aaaa …', ESTILO);

    expect(recortarLineas(['x', 'y', 'aaaa b', 'z'], 3, ESTILO, ancho)).toEqual([
      'x',
      'y',
      'aaaa…',
    ]);
  });

  it('[C-8] si la línea con los puntos suspensivos llena justo el ancho, no se acorta más', () => {
    const ancho = anchoDe('tres…', ESTILO);

    expect(recortarLineas(LINEAS, 3, ESTILO, ancho)).toEqual(['uno', 'dos', 'tres…']);
  });

  it('[C-8] con un ancho que no da ni para los puntos suspensivos, la última línea se queda en ellos', () => {
    expect(recortarLineas(LINEAS, 3, ESTILO, 1)).toEqual(['uno', 'dos', '…']);
  });
});
