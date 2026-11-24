import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '../../src');
const TOKENS = join(SRC, 'ui', 'tokens.css');

// Las utilidades de Tailwind que miden con la escala de espaciado. Con el tema por defecto apagado
// (--*: initial) no hay --spacing: `pb-0` o `inset-x-0` no producen CSS, no avisan, y la regla
// simplemente no existe. Solo valen los números que tokens.css declara como --spacing-<número>.
const UTILIDADES = [
  ...['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe'],
  ...['m', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me'],
  ...['gap', 'gap-x', 'gap-y', 'space-x', 'space-y'],
  ...['inset', 'inset-x', 'inset-y', 'top', 'right', 'bottom', 'left'],
  ...['w', 'h', 'size', 'min-w', 'min-h', 'max-w', 'max-h', 'basis'],
];
const CLASE_NUMERICA = new RegExp(
  `^(?:[\\w@[\\]-]+:)*-?(?:${UTILIDADES.join('|')})-(\\d+(?:\\.\\d+)?)$`,
);
const PALABRA = /[\w@:[\]./-]+/g;

const numeroDe = (palabra: string) => palabra.match(CLASE_NUMERICA)?.[1];

const archivosTsx = () =>
  readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter(
    (ruta) => ruta.endsWith('.tsx') && !ruta.endsWith('.test.tsx'),
  );

/** Cada clase de espaciado con número, con «ruta:línea: clase» y el número que usa. */
const clasesNumericas = () =>
  archivosTsx().flatMap((ruta) =>
    readFileSync(join(SRC, ruta), 'utf8')
      .split('\n')
      .flatMap((linea, indice) =>
        (linea.match(PALABRA) ?? []).flatMap((palabra) => {
          const numero = numeroDe(palabra);
          return numero === undefined
            ? []
            : [{ lugar: `${ruta}:${indice + 1}: ${palabra}`, numero }];
        }),
      ),
  );

describe('espaciado del tema', () => {
  it('[C-14][D-9] cada clase de espaciado con número tiene su --spacing-<número> en tokens.css', () => {
    const css = readFileSync(TOKENS, 'utf8');
    const declarados = new Set(
      [...css.matchAll(/--spacing-(\d+(?:\.\d+)?)\s*:/g)].map((coincidencia) => coincidencia[1]),
    );

    const sinDeclarar = clasesNumericas()
      .filter(({ numero }) => !declarados.has(numero))
      .map(({ lugar, numero }) => `${lugar} (falta --spacing-${numero})`);

    expect(sinDeclarar).toEqual([]);
  });

  it('el detector reconoce las clases con variantes, signo y decimales, y deja pasar las del tema', () => {
    expect(numeroDe('lg:pb-0')).toBe('0');
    expect(numeroDe('last:pb-0')).toBe('0');
    expect(numeroDe('hover:focus:-mt-1.5')).toBe('1.5');
    expect(numeroDe('inset-x-0')).toBe('0');
    expect(numeroDe('min-w-0')).toBe('0');
    expect(numeroDe('pb-e8')).toBeUndefined();
    expect(numeroDe('size-e5')).toBeUndefined();
    expect(numeroDe('min-h-toque')).toBeUndefined();
    expect(numeroDe('z-20')).toBeUndefined();
    expect(numeroDe('grid-cols-3')).toBeUndefined();
  });
});
