import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const raiz = resolve(import.meta.dirname, '../..');

// Cargar la configuración de eslint en frío tarda más que el límite por defecto de vitest.
const TIEMPO_MAXIMO_DE_ESLINT = 60_000;

const REGLAS_DEL_NUCLEO_PURO = ['no-restricted-syntax', 'no-restricted-globals'];

const eslint = new ESLint({ cwd: raiz });

// Los avisos de las reglas del núcleo puro al revisar `codigo` como si fuera el archivo `ruta`.
async function avisosDe(codigo: string, ruta: string): Promise<string[]> {
  const [resultado] = await eslint.lintText(codigo, { filePath: resolve(raiz, ruta) });
  return resultado.messages
    .filter(({ ruleId }) => REGLAS_DEL_NUCLEO_PURO.includes(ruleId ?? ''))
    .map(({ message }) => message);
}

const LEE_EL_RELOJ_EL_AZAR_EL_ENTORNO_O_LA_RED: [string, string][] = [
  ['Date.now()', 'export const ahora = () => Date.now();'],
  ['new Date() sin argumentos', 'export const hoy = () => new Date();'],
  ['Math.random()', 'export const azar = () => Math.random();'],
  ['process.env', 'export const url = process.env.SUPABASE_URL;'],
  ['fetch', "export const pedir = () => fetch('https://ejemplo.test');"],
];

const SIGUE_SIENDO_PURO: [string, string][] = [
  ['new Date con la fecha que recibe', 'export const de = (iso: string) => new Date(iso);'],
  ['new Date con el instante cero', 'export const cero = () => new Date(0);'],
  ['Date.UTC', 'export const utc = () => Date.UTC(2026, 10, 24);'],
  ['Math.max', 'export const mayor = (a: number, b: number) => Math.max(a, b);'],
];

describe('núcleo puro', () => {
  it.each(LEE_EL_RELOJ_EL_AZAR_EL_ENTORNO_O_LA_RED)(
    '[D-1] src/nucleo no puede usar %s',
    async (_, codigo) => {
      expect(await avisosDe(codigo, 'src/nucleo/ejemplo.ts')).toHaveLength(1);
    },
    TIEMPO_MAXIMO_DE_ESLINT,
  );

  it.each(SIGUE_SIENDO_PURO)(
    '[D-1] src/nucleo admite %s',
    async (_, codigo) => {
      expect(await avisosDe(codigo, 'src/nucleo/ejemplo.ts')).toEqual([]);
    },
    TIEMPO_MAXIMO_DE_ESLINT,
  );

  it(
    '[D-1] la prohibición alcanza también a los tests del núcleo',
    async () => {
      const [, codigo] = LEE_EL_RELOJ_EL_AZAR_EL_ENTORNO_O_LA_RED[0];

      expect(await avisosDe(codigo, 'src/nucleo/ejemplo.test.ts')).toHaveLength(1);
    },
    TIEMPO_MAXIMO_DE_ESLINT,
  );

  it.each(LEE_EL_RELOJ_EL_AZAR_EL_ENTORNO_O_LA_RED)(
    '[D-1] fuera de src/nucleo se puede usar %s',
    async (_, codigo) => {
      expect(await avisosDe(codigo, 'src/aplicacion/ejemplo.ts')).toEqual([]);
    },
    TIEMPO_MAXIMO_DE_ESLINT,
  );
});
