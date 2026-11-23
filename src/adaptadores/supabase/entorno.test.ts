import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { leerEntorno } from './entorno';

const NOMBRES = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'] as const;

type Nombre = (typeof NOMBRES)[number];

// Cada variable vale algo distinto, para ver en los resultados que cada valor va a su sitio.
const ENTORNO_COMPLETO = Object.fromEntries(
  NOMBRES.map((nombre) => [nombre, `valor de ${nombre}`]),
) as Record<Nombre, string>;

const sin = (nombre: Nombre) => ({ ...ENTORNO_COMPLETO, [nombre]: undefined });
const vacia = (nombre: Nombre) => ({ ...ENTORNO_COMPLETO, [nombre]: '' });
const error = (nombre: Nombre) => new Error(`Falta la variable de entorno ${nombre}`);

describe('leerEntorno', () => {
  it('[D-2] falta de una variable da error con su nombre', () => {
    expect(() => leerEntorno({ SUPABASE_PUBLISHABLE_KEY: 'x' })).toThrow(error('SUPABASE_URL'));
  });

  it.each(NOMBRES)('[D-2] %s ausente o vacía da error con su nombre', (nombre) => {
    expect(() => leerEntorno(sin(nombre))).toThrow(error(nombre));
    expect(() => leerEntorno(vacia(nombre))).toThrow(error(nombre));
  });

  it('[D-2] sin ninguna variable avisa de la primera que falta', () => {
    expect(() => leerEntorno({})).toThrow(error('SUPABASE_URL'));
  });

  it('devuelve la URL y la clave publicable y descarta lo demás, la clave secreta incluida', () => {
    expect(leerEntorno({ ...ENTORNO_COMPLETO, SUPABASE_SECRET_KEY: 'valor secreto' })).toEqual({
      url: ENTORNO_COMPLETO.SUPABASE_URL,
      clavePublicable: ENTORNO_COMPLETO.SUPABASE_PUBLISHABLE_KEY,
    });
  });

  it('lo que entra sale igual, sea cual sea el texto', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (url, clave) => {
        const entorno = { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: clave };

        expect(leerEntorno(entorno)).toEqual({ url, clavePublicable: clave });
      }),
    );
  });
});
