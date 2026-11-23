import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validarRecambio } from './recambios';

const MENSAJES = {
  referencia: 'La referencia tiene entre 2 y 20 caracteres',
  nombre: 'Falta el nombre del recambio',
  precio: 'Precio no válido. Ejemplo: 12,50',
  entero: 'Tiene que ser un número entero, cero o más',
};

const RECAMBIO = {
  referencia: 'fil-01',
  nombre: 'Filtro de aceite',
  precio: '12,50',
  stock: '5',
  stockMinimo: 2,
};

const fallo = (errores: Record<string, string>) => ({ ok: false, errores });

describe('validarRecambio', () => {
  it('acepta un recambio, pone la referencia en mayúsculas y pasa el precio a céntimos', () => {
    expect(validarRecambio(RECAMBIO)).toEqual({
      ok: true,
      datos: {
        referencia: 'FIL-01',
        nombre: 'Filtro de aceite',
        precioCentimos: 1250,
        stock: 5,
        stockMinimo: 2,
      },
    });
  });

  it('[D-2] valida el recambio y explica los errores', () => {
    const resultado = validarRecambio({
      ...RECAMBIO,
      referencia: 'a',
      precio: '12,505',
      stock: -1,
    });

    expect(resultado).toEqual(
      fallo({ referencia: MENSAJES.referencia, precio: MENSAJES.precio, stock: MENSAJES.entero }),
    );
  });

  it('explica a la vez todos los campos mal escritos', () => {
    const resultado = validarRecambio({ referencia: '', nombre: ' ', precio: 'x', stock: 'x' });

    expect(resultado).toEqual(
      fallo({
        referencia: MENSAJES.referencia,
        nombre: MENSAJES.nombre,
        precio: MENSAJES.precio,
        stock: MENSAJES.entero,
        stockMinimo: MENSAJES.entero,
      }),
    );
  });

  it('recorta los espacios de la referencia y del nombre', () => {
    const resultado = validarRecambio({ ...RECAMBIO, referencia: ' fil-01 ', nombre: ' Filtro ' });

    expect(resultado).toMatchObject({
      ok: true,
      datos: { referencia: 'FIL-01', nombre: 'Filtro' },
    });
  });
});

describe('validarRecambio, límites de texto', () => {
  it.each([
    ['referencia', 'ab', true],
    ['referencia', 'a'.repeat(20), true],
    ['referencia', 'a', false],
    ['referencia', 'a'.repeat(21), false],
    ['referencia', ' a ', false],
    ['nombre', 'ab', true],
    ['nombre', 'a'.repeat(80), true],
    ['nombre', 'a', false],
    ['nombre', 'a'.repeat(81), false],
  ])('el campo %s con «%s» %s', (campo, texto, valido) => {
    const { ok } = validarRecambio({ ...RECAMBIO, [campo]: texto });

    expect(ok).toBe(valido);
  });

  it.each([
    ['referencia', 12],
    ['referencia', null],
    ['nombre', undefined],
    ['nombre', ['ab']],
  ])('[D-2] el campo %s con %j no es un texto', (campo, valor) => {
    const resultado = validarRecambio({ ...RECAMBIO, [campo]: valor });

    expect(resultado).toEqual(fallo({ [campo]: MENSAJES[campo as 'referencia' | 'nombre'] }));
  });
});

describe('validarRecambio, precio', () => {
  it.each([
    ['0', 0],
    ['12', 1200],
    ['12,5', 1250],
    ['12.50', 1250],
    ['0,1', 10],
    [' 7,05 ', 705],
  ])('[D-5] el precio «%s» son %i céntimos', (escrito, centimos) => {
    const resultado = validarRecambio({ ...RECAMBIO, precio: escrito });

    expect(resultado).toMatchObject({ ok: true, datos: { precioCentimos: centimos } });
  });

  it.each([
    ['vacío', ''],
    ['letras', 'abc'],
    ['tres decimales', '12,505'],
    ['negativo', '-1'],
    ['notación científica', '1e3'],
    ['dos separadores', '12,5,0'],
    ['un número en vez de texto', 12.5],
    ['nulo', null],
    ['ausente', undefined],
  ])('[D-2] rechaza un precio %s', (_nombre, precio) => {
    expect(validarRecambio({ ...RECAMBIO, precio })).toEqual(fallo({ precio: MENSAJES.precio }));
  });
});

describe('validarRecambio, stock', () => {
  it.each([
    ['cero', 0, 0],
    ['un número', 7, 7],
    ['un texto de cifras', '7', 7],
  ])('acepta el stock como %s', (_nombre, escrito, stock) => {
    expect(validarRecambio({ ...RECAMBIO, stock: escrito, stockMinimo: escrito })).toMatchObject({
      ok: true,
      datos: { stock, stockMinimo: stock },
    });
  });

  it.each([
    ['negativo', -1],
    ['con decimales', 1.5],
    ['un texto con decimales', '1.5'],
    ['un texto negativo', '-3'],
    ['letras', 'abc'],
    ['vacío', ''],
    ['nulo', null],
    ['verdadero', true],
  ])('[D-2] rechaza el stock y el mínimo %s', (_nombre, valor) => {
    const resultado = validarRecambio({ ...RECAMBIO, stock: valor, stockMinimo: valor });

    expect(resultado).toEqual(fallo({ stock: MENSAJES.entero, stockMinimo: MENSAJES.entero }));
  });
});

describe('validarRecambio, entrada basura', () => {
  it.each([
    ['null', null],
    ['un texto', 'x'],
    ['un número', 5],
    ['una lista', [RECAMBIO]],
  ])('[D-2] una entrada que no es un objeto (%s) se rechaza', (_nombre, entrada) => {
    expect(validarRecambio(entrada).ok).toBe(false);
  });

  it('[D-2] ninguna entrada hace lanzar al validador', () => {
    fc.assert(
      fc.property(fc.anything(), (entrada) => {
        expect(typeof validarRecambio(entrada).ok).toBe('boolean');
      }),
    );
  });

  it('[D-5] los céntimos que salen son un entero que vuelve a dar el mismo importe', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99_999_999 }), (centimos) => {
        const escrito = `${Math.floor(centimos / 100)},${String(centimos % 100).padStart(2, '0')}`;

        const resultado = validarRecambio({ ...RECAMBIO, precio: escrito });

        expect(resultado).toMatchObject({ ok: true, datos: { precioCentimos: centimos } });
      }),
    );
  });
});
