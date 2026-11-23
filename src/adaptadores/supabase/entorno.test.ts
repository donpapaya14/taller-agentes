import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ErrorDeEntorno, leerEntorno } from './entorno';

const ENTORNO_COMPLETO = {
  SUPABASE_URL: 'https://proyecto.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'clave-publicable',
};

type Nombre = keyof typeof ENTORNO_COMPLETO;

const NOMBRES = Object.keys(ENTORNO_COMPLETO) as Nombre[];
const falta = (nombre: Nombre) => new ErrorDeEntorno(`Falta la variable de entorno ${nombre}`);
const URL_NO_VALIDA = new ErrorDeEntorno(
  'La variable de entorno SUPABASE_URL no es una URL válida: debe empezar por http:// o https://',
);
const conUrl = (url: string) => ({ ...ENTORNO_COMPLETO, SUPABASE_URL: url });

describe('leerEntorno con variables que faltan', () => {
  it('[D-2] falta de una variable da error con su nombre', () => {
    expect(() => leerEntorno({ SUPABASE_PUBLISHABLE_KEY: 'x' })).toThrow(falta('SUPABASE_URL'));
  });

  it.each(NOMBRES)(
    '[D-2] %s ausente, vacía o solo con espacios da error con su nombre',
    (nombre) => {
      const ausente = { ...ENTORNO_COMPLETO, [nombre]: undefined };
      const vacia = { ...ENTORNO_COMPLETO, [nombre]: '' };
      const conEspacios = { ...ENTORNO_COMPLETO, [nombre]: ' \t\n ' };

      expect(() => leerEntorno(ausente)).toThrow(falta(nombre));
      expect(() => leerEntorno(vacia)).toThrow(falta(nombre));
      expect(() => leerEntorno(conEspacios)).toThrow(falta(nombre));
    },
  );

  it('[D-2] sin ninguna variable avisa de la primera que falta', () => {
    expect(() => leerEntorno({})).toThrow(falta('SUPABASE_URL'));
  });

  it('[D-2] el error de entorno es de una clase propia, para distinguirlo de otros fallos', () => {
    expect(() => leerEntorno({})).toThrow(ErrorDeEntorno);
    expect(() => leerEntorno(conUrl('no es una url'))).toThrow(ErrorDeEntorno);
  });

  it('el error de entorno es un Error con su propio nombre, para que el log lo diga', () => {
    const error = new ErrorDeEntorno('Falta la variable de entorno X');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ErrorDeEntorno');
    expect(error.message).toBe('Falta la variable de entorno X');
  });
});

describe('leerEntorno con la URL de Supabase', () => {
  it.each([
    'no es una url',
    'proyecto.supabase.co',
    '//proyecto.supabase.co',
    'file:///etc/hosts',
    'httpx://proyecto.supabase.co',
    'xhttp://proyecto.supabase.co',
    'javascript:alert(1)',
    'https://',
  ])('[D-2] SUPABASE_URL con «%s» no es una URL http ni https', (url) => {
    expect(() => leerEntorno(conUrl(url))).toThrow(URL_NO_VALIDA);
  });

  it.each([
    'https://proyecto.supabase.co',
    'http://127.0.0.1:54321',
    'http://localhost:54321',
    'https://proyecto.supabase.co/rest/v1',
  ])('acepta la URL %s', (url) => {
    expect(leerEntorno(conUrl(url)).url).toBe(url);
  });
});

describe('leerEntorno con lo que devuelve', () => {
  it('recorta los espacios de la URL y de la clave publicable', () => {
    const entorno = {
      SUPABASE_URL: ' https://proyecto.supabase.co \n',
      SUPABASE_PUBLISHABLE_KEY: '\t clave-publicable ',
    };

    expect(leerEntorno(entorno)).toEqual({
      url: 'https://proyecto.supabase.co',
      clavePublicable: 'clave-publicable',
    });
  });

  it('devuelve la URL y la clave publicable y descarta lo demás, la clave secreta incluida', () => {
    expect(leerEntorno({ ...ENTORNO_COMPLETO, SUPABASE_SECRET_KEY: 'valor secreto' })).toEqual({
      url: ENTORNO_COMPLETO.SUPABASE_URL,
      clavePublicable: ENTORNO_COMPLETO.SUPABASE_PUBLISHABLE_KEY,
    });
  });

  it('lo que entra sale igual, sin los espacios de los bordes, sea cual sea la clave', () => {
    const claveConTexto = fc.string({ minLength: 1 }).filter((clave) => clave.trim() !== '');

    fc.assert(
      fc.property(fc.webUrl(), claveConTexto, (url, clave) => {
        const entorno = { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: clave };

        expect(leerEntorno(entorno)).toEqual({ url, clavePublicable: clave.trim() });
      }),
    );
  });
});
