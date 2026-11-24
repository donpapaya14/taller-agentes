import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = resolve(import.meta.dirname, '../..');

const TOTAL_DE_DIRECTRICES = 15;

type FilaDeDirectriz = { id: string; demostracion: string };

const INICIO_DEL_BLOQUE_DE_ESTADO = '<!-- estado:inicio -->';

// Las filas `| D-n | Directriz | Cómo se demuestra |` de la tabla de DIRECTRICES.md. Lo que va desde
// el bloque de estado, que escribe spec:check y repite los ID, no es la tabla.
function filasDeDirectrices(texto: string): FilaDeDirectriz[] {
  return texto
    .split(INICIO_DEL_BLOQUE_DE_ESTADO)[0]
    .split('\n')
    .map((linea) => linea.split('|').map((celda) => celda.trim()))
    .filter((celdas) => /^D-\d+$/.test(celdas[1] ?? ''))
    .map((celdas) => ({ id: celdas[1], demostracion: celdas[3] ?? '' }));
}

describe('DIRECTRICES.md', () => {
  it('[P-3] hay 15 directrices con ID único y demostración no vacía', () => {
    const filas = filasDeDirectrices(readFileSync(resolve(raiz, 'DIRECTRICES.md'), 'utf8'));
    const ids = filas.map((fila) => fila.id);
    const esperados = Array.from({ length: TOTAL_DE_DIRECTRICES }, (_, i) => `D-${i + 1}`);

    expect(ids).toHaveLength(TOTAL_DE_DIRECTRICES);
    expect(new Set(ids)).toEqual(new Set(esperados));
    expect(filas.filter((fila) => fila.demostracion === '')).toEqual([]);
  });

  // spec:check escribe al final de DIRECTRICES.md una fila por directriz con su estado.
  it('[P-3] el bloque de estado que escribe spec:check no cuenta como directrices', () => {
    const conBloqueDeEstado = [
      '| D-1 | La lógica vive en el núcleo | test `[D-1]` |',
      '',
      '<!-- estado:inicio -->',
      '| D-1 | VERIFICADO | 16 | 2026-11-24 |',
      '<!-- estado:fin -->',
    ].join('\n');

    expect(filasDeDirectrices(conBloqueDeEstado).map((fila) => fila.id)).toEqual(['D-1']);
  });
});
