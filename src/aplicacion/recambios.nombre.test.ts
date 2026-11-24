import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validarRecambio } from './recambios';

const FALTA = 'Falta el nombre del recambio';
const RANGO = 'El nombre tiene entre 2 y 80 caracteres';

// Un nombre de catálogo de verdad, más largo que el límite de 80 caracteres.
const NOMBRE_DE_CATALOGO =
  'Pastillas de freno delanteras Bosch 0 986 494 xxx para Seat León 1.6 TDI 2012-2019 juego de cuatro';

const recambioCon = (nombre: unknown) => ({
  referencia: 'pas-07',
  nombre,
  precio: '45,90',
  stock: '4',
  stockMinimo: '2',
});

const falla = (mensaje: string) => ({ ok: false, errores: { nombre: mensaje } });

// Un nombre largo es un nombre que hay que acortar, no uno que falta: el mensaje dice el límite,
// como el de la referencia. Solo el nombre vacío, o que no es un texto, dice que falta.
describe('validarRecambio, mensaje del nombre', () => {
  it('[D-14] el nombre de catálogo del ejemplo mide más de 80 caracteres', () => {
    expect(NOMBRE_DE_CATALOGO.length).toBeGreaterThan(80);
  });

  it.each([
    ['81 letras', 'a'.repeat(81)],
    ['un nombre de catálogo de más de 80 caracteres', NOMBRE_DE_CATALOGO],
    ['200 letras', 'a'.repeat(200)],
    ['81 letras entre espacios', ` ${'a'.repeat(81)} `],
  ])('[D-14] un nombre de %s dice el rango, no que falta', (_caso, nombre) => {
    expect(validarRecambio(recambioCon(nombre))).toEqual(falla(RANGO));
  });

  it.each([
    ['una letra', 'a'],
    ['una letra entre espacios', '  a  '],
  ])('[D-14] un nombre de %s dice el rango, no que falta', (_caso, nombre) => {
    expect(validarRecambio(recambioCon(nombre))).toEqual(falla(RANGO));
  });

  it.each([
    ['vacío', ''],
    ['solo espacios', '   '],
    ['ausente', undefined],
    ['nulo', null],
    ['un número', 12],
    ['una lista', ['ab']],
  ])('[D-14] un nombre %s sigue diciendo que falta', (_caso, nombre) => {
    expect(validarRecambio(recambioCon(nombre))).toEqual(falla(FALTA));
  });
});

describe('validarRecambio, límites del nombre', () => {
  it.each([
    ['dos letras', 'ab', 'ab'],
    ['80 letras', 'a'.repeat(80), 'a'.repeat(80)],
    ['80 letras entre espacios', ` ${'a'.repeat(80)} `, 'a'.repeat(80)],
  ])('un nombre de %s se acepta, sin los espacios de los lados', (_caso, nombre, guardado) => {
    expect(validarRecambio(recambioCon(nombre))).toMatchObject({
      ok: true,
      datos: { nombre: guardado },
    });
  });

  it('[D-14] el mensaje depende solo de lo que mide el nombre sin los espacios de los lados', () => {
    const conEspacios = fc
      .array(fc.constantFrom('a', 'é', ' ', ' ', '\t'), { maxLength: 120 })
      .map((letras) => letras.join(''));

    fc.assert(
      fc.property(conEspacios, (nombre) => {
        const largo = nombre.trim().length;
        const resultado = validarRecambio(recambioCon(nombre));

        if (largo === 0) expect(resultado).toEqual(falla(FALTA));
        else if (largo === 1 || largo > 80) expect(resultado).toEqual(falla(RANGO));
        else expect(resultado.ok).toBe(true);
      }),
    );
  });
});
