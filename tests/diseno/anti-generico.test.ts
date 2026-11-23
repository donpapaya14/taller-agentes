import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '../../src');

// Lo que delata una interfaz genérica hecha con IA (C-17). Los patrones llevan la bandera g
// porque se buscan sobre el archivo entero: un titular puede partirse en varias líneas de JSX.
const VETADOS: Record<string, RegExp> = {
  'tipografía vetada': /\b(?:Inter|Roboto|Arial|system-ui|Space Grotesk|Poppins)\b/gi,
  'antetítulo numerado': /\(0\d\)|\[ ?0\d ?\]|\b0\d ?[—–-] ?[A-ZÁÉÍÓÚ]{3,}/g,
  'titular por contraste': /\bNo es [^.]{1,60}\.\s*Es\b/g,
  emoji: /\p{Extended_Pictographic}/gu,
  'texto de relleno': /\blorem ipsum\b/gi,
};

// Un tamaño de letra aparece en una declaración font-size, en un token de tamaño (--cuerpo-*
// o --text-*, sin contar sus modificadores --text-*--line-height) o en una clase arbitraria
// de Tailwind como text-[12px].
const DECLARACION_DE_TAMANO = /font-size\s*:\s*([^;}]+)/g;
const TOKEN_DE_TAMANO = /--(?:cuerpo|text)-([a-z0-9-]+)\s*:\s*([^;}]+)/g;
const CLASE_DE_TAMANO = /\btext-\[([^\]]+)\]/g;
const LONGITUD = /[\d.]+[a-z%]*/g;
const MINIMO_POR_UNIDAD: Record<string, number> = { px: 14, rem: 0.875, em: 0.875 };

// Solo cuentan px, rem y em; un vw o un número sin unidad no es un tamaño que se pueda medir aquí.
const esPequena = (longitud: string) => {
  const unidad = longitud.replace(/^[\d.]+/, '');
  return unidad in MINIMO_POR_UNIDAD && Number.parseFloat(longitud) < MINIMO_POR_UNIDAD[unidad];
};

const interfaz = () =>
  readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((ruta) => /\.(?:tsx|css)$/.test(ruta))
    .map((ruta) => ({ ruta, texto: readFileSync(join(SRC, ruta), 'utf8') }));

const lineaDe = (texto: string, posicion = 0) => texto.slice(0, posicion).split('\n').length;

/** «ruta:línea: fragmento» de cada coincidencia del patrón en la interfaz. */
const coincidencias = (patron: RegExp) =>
  interfaz().flatMap(({ ruta, texto }) =>
    [...texto.matchAll(patron)].map((m) => `${ruta}:${lineaDe(texto, m.index)}: ${m[0]}`),
  );

/** Cada valor de tamaño de letra del archivo, con la posición en la que aparece. */
const tamanosDe = (texto: string) => [
  ...[...texto.matchAll(DECLARACION_DE_TAMANO)].map((m) => ({ valor: m[1], posicion: m.index })),
  ...[...texto.matchAll(TOKEN_DE_TAMANO)]
    .filter((m) => !m[1].includes('--'))
    .map((m) => ({ valor: m[2], posicion: m.index })),
  ...[...texto.matchAll(CLASE_DE_TAMANO)].map((m) => ({ valor: m[1], posicion: m.index })),
];

describe('interfaz sin rastro genérico', () => {
  it('[C-17][D-12] sin tipografías vetadas, antetítulos numerados, titulares por contraste ni emojis', () => {
    const encontrados = Object.entries(VETADOS).flatMap(([motivo, patron]) =>
      coincidencias(patron).map((sitio) => `${motivo} → ${sitio}`),
    );

    expect(encontrados).toEqual([]);
  });

  it('[C-17][D-12] ningún texto por debajo de 14 px', () => {
    const pequenos = interfaz().flatMap(({ ruta, texto }) =>
      tamanosDe(texto).flatMap(({ valor, posicion }) =>
        [...valor.matchAll(LONGITUD)]
          .filter(([longitud]) => esPequena(longitud))
          .map(([longitud]) => `${ruta}:${lineaDe(texto, posicion)}: ${longitud}`),
      ),
    );

    expect(pequenos).toEqual([]);
    expect(coincidencias(/\btext-xs\b/g)).toEqual([]);
  });
});
