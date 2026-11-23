import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PARES } from '@/ui/pares-contraste';
import { contraste } from './contraste';

const SRC = resolve(import.meta.dirname, '../../src');
const TOKENS = join('ui', 'tokens.css');

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/;

const UTILIDADES_DE_COLOR = ['bg', 'text', 'border', 'ring', 'fill', 'stroke'];
const COLORES_DE_TAILWIND = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
];
const PALETA_DE_TAILWIND = new RegExp(
  `\\b(?:${UTILIDADES_DE_COLOR.join('|')})-(?:${COLORES_DE_TAILWIND.join('|')})-\\d`,
);

// Los once pares de texto y fondo que fija el SPEC, todos con mínimo AA de 4,5.
const PARES_DEL_SPEC = [
  'hueso/foso',
  'hueso/chapa',
  'hueso/chapa-alta',
  'acero/foso',
  'acero/chapa',
  'foso/lampara',
  'lampara/foso',
  'ambar/chapa',
  'testigo/chapa',
  'averia/chapa',
  'placa-texto/placa',
];

const archivosDeSrc = (extension: RegExp) =>
  readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter((ruta) => extension.test(ruta));

/** «ruta:línea: texto» de cada línea del archivo que cumple el patrón. */
const lineasQueCumplen = (ruta: string, patron: RegExp) =>
  readFileSync(join(SRC, ruta), 'utf8')
    .split('\n')
    .flatMap((linea, indice) =>
      patron.test(linea) ? [`${ruta}:${indice + 1}: ${linea.trim()}`] : [],
    );

/** Valor hex con el que tokens.css declara `--<nombre>`. */
const hexDelToken = (css: string, nombre: string): string => {
  const declaracion = new RegExp(`(?<![\\w-])--${nombre}\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;`);
  const valor = css.match(declaracion)?.[1];
  if (!valor) throw new Error(`tokens.css no declara --${nombre} con un color hex`);
  return valor;
};

describe('tokens de FOSO', () => {
  it('[D-10] el contraste sigue la fórmula WCAG: blanco y negro dan 21, un color consigo mismo da 1', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contraste('#fff', '#000')).toBeCloseTo(21, 5);
    expect(contraste('#9aa1aa', '#9aa1aa')).toBe(1);
    expect(contraste('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('[D-10] un color que no es hex de 3 o 6 cifras es un error, no un contraste', () => {
    expect(() => contraste('naranja', '#000000')).toThrow('naranja');
    expect(() => contraste('#12345', '#000000')).toThrow('#12345');
  });

  it('[C-14][D-9] ningún color literal fuera de tokens.css', () => {
    const literales = archivosDeSrc(/\.(?:ts|tsx|css)$/)
      .filter((ruta) => ruta !== TOKENS)
      .flatMap((ruta) => lineasQueCumplen(ruta, COLOR_LITERAL));

    expect(literales).toEqual([]);
  });

  it('[C-14][D-9] ninguna clase de la paleta por defecto de Tailwind', () => {
    const clases = archivosDeSrc(/\.tsx$/).flatMap((ruta) =>
      lineasQueCumplen(ruta, PALETA_DE_TAILWIND),
    );

    expect(clases).toEqual([]);
  });

  it('[C-14][D-10] pares-contraste declara los once pares del SPEC con mínimo 4,5', () => {
    const declarados = PARES.map(({ texto, fondo, minimo }) => `${texto}/${fondo} ≥ ${minimo}`);

    expect(declarados).toEqual(expect.arrayContaining(PARES_DEL_SPEC.map((par) => `${par} ≥ 4.5`)));
  });

  it('[C-14][D-10] cada par declarado cumple su contraste mínimo', () => {
    const css = readFileSync(join(SRC, TOKENS), 'utf8');
    const insuficientes = PARES.map(({ texto, fondo, minimo }) => ({
      par: `${texto}/${fondo}`,
      minimo,
      medido: contraste(hexDelToken(css, texto), hexDelToken(css, fondo)),
    })).filter(({ medido, minimo }) => medido < minimo);

    expect(PARES.length).toBeGreaterThanOrEqual(PARES_DEL_SPEC.length);
    expect(insuficientes).toEqual([]);
  });
});
