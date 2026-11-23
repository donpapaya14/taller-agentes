import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { normalizarMatricula } from './matricula';

const CASOS = [
  { texto: '1234 bcd', esperado: '1234BCD' },
  { texto: 'm-1234-ab', esperado: 'M1234AB' },
  { texto: '1234AEI', esperado: null },
  { texto: '12BCD', esperado: null },
  { texto: '1234BCD', esperado: '1234BCD' },
  { texto: ' 1234 - bcd ', esperado: '1234BCD' },
  { texto: '1234 B C D', esperado: '1234BCD' },
  { texto: '1234BC', esperado: null },
  { texto: '1234BCDF', esperado: null },
  { texto: '12345BCD', esperado: null },
  { texto: '1234BCQ', esperado: null },
  { texto: '1234ÑBC', esperado: null },
  { texto: 'M1234A', esperado: 'M1234A' },
  { texto: 'b1234cd', esperado: 'B1234CD' },
  { texto: 'MA1234B', esperado: 'MA1234B' },
  { texto: 'MA1234AB', esperado: 'MA1234AB' },
  { texto: 'ABC1234DE', esperado: null },
  { texto: 'M1234', esperado: null },
  { texto: 'M123AB', esperado: null },
  { texto: 'M12345AB', esperado: null },
  { texto: 'M1234ABC', esperado: null },
  { texto: '', esperado: null },
  { texto: 'abc', esperado: null },
];

const cuatroCifras = fc.stringMatching(/^\d{4}$/);
const tresConsonantes = fc.stringMatching(/^[BCDFGHJKLMNPRSTVWXYZ]{3}$/);
const unaODosLetras = fc.stringMatching(/^[A-Z]{1,2}$/);
const separador = fc.constantFrom('', ' ', '-', ' - ');

describe('matrícula', () => {
  it.each(CASOS)('[C-11] normaliza matrículas: "$texto"', ({ texto, esperado }) => {
    expect(normalizarMatricula(texto)).toBe(esperado);
  });

  it('[C-11] el formato actual lleva cuatro cifras y tres consonantes, escrito como se escriba', () => {
    fc.assert(
      fc.property(cuatroCifras, tresConsonantes, separador, (cifras, letras, entre) => {
        const escrita = `${cifras}${entre}${letras.toLowerCase()}`;

        expect(normalizarMatricula(escrita)).toBe(`${cifras}${letras}`);
      }),
    );
  });

  it('[C-11] en el formato actual una vocal o la Q en cualquier sitio la invalida', () => {
    fc.assert(
      fc.property(
        cuatroCifras,
        tresConsonantes,
        fc.integer({ min: 0, max: 2 }),
        fc.constantFrom(...'AEIOUQ'),
        (cifras, letras, posicion, intrusa) => {
          const letrasMalas = letras.slice(0, posicion) + intrusa + letras.slice(posicion + 1);

          expect(normalizarMatricula(cifras + letrasMalas)).toBeNull();
        },
      ),
    );
  });

  it('[C-11] el formato antiguo lleva una o dos letras, cuatro cifras y una o dos letras', () => {
    fc.assert(
      fc.property(
        unaODosLetras,
        cuatroCifras,
        unaODosLetras,
        separador,
        (provincia, cifras, final, entre) => {
          const escrita = [provincia.toLowerCase(), cifras, final].join(entre);

          expect(normalizarMatricula(escrita)).toBe(`${provincia}${cifras}${final}`);
        },
      ),
    );
  });
});
