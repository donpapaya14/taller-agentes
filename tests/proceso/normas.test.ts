import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const raiz = resolve(import.meta.dirname, '../..');
const NIVEL_ERROR = 2;
const SEGUNDOS_PARA_CARGAR_ESLINT = 60;

// Los patrones se montan por piezas: escritos enteros, este archivo se encontraría a sí mismo.
const ATAJOS: Record<string, RegExp> = {
  'test saltado': new RegExp(`\\.${'ski'}p\\(`),
  'test único': new RegExp(`\\.${'onl'}y\\(`),
  'lint desactivado': new RegExp(['eslint', 'disable'].join('-')),
  'tipos ignorados': new RegExp(['@ts', 'ignore'].join('-')),
  'tipo suelto': new RegExp(`:\\s*${'an'}y\\b`),
  'HTML sin escapar': new RegExp(['dangerously', 'SetInnerHTML'].join('')),
};

const textoDe = (relativa: string) => readFileSync(resolve(raiz, relativa), 'utf8');

const fuentesBajo = (carpeta: string) =>
  readdirSync(resolve(raiz, carpeta), { recursive: true, encoding: 'utf8' })
    .filter((ruta) => /\.[cm]?[jt]sx?$/.test(ruta))
    .map((ruta) => `${carpeta}/${ruta}`);

describe('configuración de eslint', () => {
  let reglas: Record<string, unknown[] | undefined>;

  beforeAll(async () => {
    const eslint = new ESLint({ cwd: raiz });
    ({ rules: reglas } = await eslint.calculateConfigForFile('src/aplicacion/acceso.ts'));
  }, SEGUNDOS_PARA_CARGAR_ESLINT * 1000);

  it('[D-7] eslint tiene los límites como error', () => {
    expect(reglas['max-lines']).toEqual([NIVEL_ERROR, expect.objectContaining({ max: 300 })]);
    expect(reglas['max-lines-per-function']).toEqual([
      NIVEL_ERROR,
      expect.objectContaining({ max: 50 }),
    ]);
    expect(reglas['complexity']).toEqual([NIVEL_ERROR, 10]);
    expect(reglas['max-params']).toEqual([NIVEL_ERROR, 4]);
  });

  it('[D-14] eslint prohíbe catch vacío, console y HTML sin escapar', () => {
    const niveles = ['no-empty', 'no-console', 'react/no-danger'].map(
      (regla) => reglas[regla]?.[0],
    );

    expect(niveles).toEqual([NIVEL_ERROR, NIVEL_ERROR, NIVEL_ERROR]);
  });
});

describe('atajos', () => {
  it('[D-8] sin atajos en src ni tests', () => {
    const archivos = [...fuentesBajo('src'), ...fuentesBajo('tests')];

    const atajosEncontrados = archivos.flatMap((ruta) =>
      Object.entries(ATAJOS)
        .filter(([, patron]) => patron.test(textoDe(ruta)))
        .map(([nombre]) => `${ruta}: ${nombre}`),
    );

    expect(archivos).toContain('tests/proceso/normas.test.ts');
    expect(atajosEncontrados).toEqual([]);
  });
});
