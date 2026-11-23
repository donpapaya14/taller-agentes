import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = resolve(import.meta.dirname, '../..');

const TOTAL_DE_DIRECTRICES = 15;

type FilaDeDirectriz = { id: string; demostracion: string };

// Las filas `| D-n | Directriz | Cómo se demuestra |` de la tabla de DIRECTRICES.md.
function filasDeDirectrices(texto: string): FilaDeDirectriz[] {
  return texto
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
});
