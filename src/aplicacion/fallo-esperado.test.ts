import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { falloDeSupabase } from '../../tests/apoyo/fallos-falsos';
import { esFalloEsperado } from './fallo-esperado';

const { error: errorDeZod } = z.string().safeParse(1);

describe('esFalloEsperado: lo que la aplicación sabe contar', () => {
  it('[D-14] un dato que zod rechaza es esperado, venga solo o como causa de un error', () => {
    expect(esFalloEsperado(errorDeZod)).toBe(true);
    expect(esFalloEsperado(new Error('No se entienden los datos', { cause: errorDeZod }))).toBe(
      true,
    );
  });

  it('[D-14] un error de Supabase con su código es esperado, sea el error o su causa', () => {
    const conElCodigoEnElError = Object.assign(new Error('JWT expired'), { code: 'PGRST301' });

    expect(esFalloEsperado(falloDeSupabase('permission denied', '42501'))).toBe(true);
    expect(esFalloEsperado(conElCodigoEnElError)).toBe(true);
  });

  it('[D-14] vale cualquier código de texto que no esté vacío', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (code) => {
        expect(esFalloEsperado(falloDeSupabase('error de Supabase', code))).toBe(true);
      }),
    );
  });
});

describe('esFalloEsperado: lo que se relanza', () => {
  it.each([
    ['un Error corriente', new Error('boom')],
    ['un TypeError, que es un fallo de programación', new TypeError('x is not a function')],
    ['un RangeError', new RangeError('Invalid array length')],
    ['un fallo de red de Supabase, con el código vacío', falloDeSupabase('fetch failed', '')],
    ['un código que no es un texto', new Error('x', { cause: { code: 42 } })],
    ['una causa sin código', new Error('x', { cause: { message: 'sin código' } })],
    ['una causa null', new Error('x', { cause: null })],
    ['un objeto con código que no es un Error', { message: 'x', code: '42501' }],
    ['un texto', 'boom'],
    ['un número', 42],
    ['null', null],
    ['undefined', undefined],
  ])('[D-14] %s no es esperado', (_caso, error) => {
    expect(esFalloEsperado(error)).toBe(false);
  });
});
