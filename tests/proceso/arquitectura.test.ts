import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = resolve(import.meta.dirname, '../..');

const DEPCRUISE = resolve(raiz, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs');

// Estas dos capas llevan el test de cada archivo a su lado (D-6).
const CARPETAS_CON_TEST_AL_LADO = ['src/nucleo', 'src/aplicacion'];

// dependency-cruiser carga el compilador de TypeScript: en frío tarda más que el límite por defecto.
const TIEMPO_MAXIMO_DE_DEPCRUISE = 60_000;

// Los .ts de la carpeta que no son tests, con la ruta desde la raíz del repo.
function fuentesDe(carpeta: string): string[] {
  if (!existsSync(resolve(raiz, carpeta))) return [];

  return readdirSync(resolve(raiz, carpeta), { recursive: true, encoding: 'utf8' })
    .filter((archivo) => archivo.endsWith('.ts') && !archivo.endsWith('.test.ts'))
    .map((archivo) => `${carpeta}/${archivo}`);
}

const testDe = (fuente: string): string => fuente.replace(/\.ts$/, '.test.ts');

describe('arquitectura', () => {
  it(
    '[D-1] dependency-cruiser no encuentra violaciones',
    () => {
      // Es lo que ejecuta `npx depcruise`, pero sin buscar el comando en el PATH.
      const resultado = spawnSync(
        process.execPath,
        [DEPCRUISE, 'src', '--config', '.dependency-cruiser.cjs'],
        { cwd: raiz, encoding: 'utf8' },
      );

      expect(resultado.status, `${resultado.stdout}${resultado.stderr}`).toBe(0);
    },
    TIEMPO_MAXIMO_DE_DEPCRUISE,
  );

  it('[D-6] cada archivo de nucleo y aplicacion tiene su test', () => {
    const sinTest = CARPETAS_CON_TEST_AL_LADO.flatMap(fuentesDe).filter(
      (fuente) => !existsSync(resolve(raiz, testDe(fuente))),
    );

    expect(sinTest).toEqual([]);
  });

  it('[D-6] la comprobación mira los archivos del núcleo', () => {
    expect(fuentesDe('src/nucleo')).toContain('src/nucleo/orden.ts');
  });
});
