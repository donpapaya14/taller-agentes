import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validarRecambio } from './recambios';

const MENSAJES = {
  referencia: 'La referencia tiene entre 2 y 20 caracteres',
  nombre: 'Falta el nombre del recambio',
  precio: 'Precio no válido. Ejemplo: 12,50',
  entero: 'Tiene que ser un número entero, cero o más',
  stockTope: 'El stock no puede pasar de 2.147.483.647',
  minimoTope: 'El mínimo no puede pasar de 2.147.483.647',
  precioTope: 'El precio no puede pasar de 21.474.836,47 €',
  id: 'No se reconoce el recambio. Recarga la página',
};

// Lo más que guarda una columna integer de Postgres.
const TOPE = 2_147_483_647;

const ID_RECAMBIO = '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7b64';

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

// Postgres guarda stock, mínimo y precio en céntimos como integer: más de 2147483647 lo rechaza con
// un error que no dice qué corregir, así que el validador lo dice junto al campo.
describe('validarRecambio, tope del stock y del mínimo', () => {
  const DEMASIADO = [
    ['un número', TOPE + 1],
    ['un texto de cifras', String(TOPE + 1)],
    ['el mayor entero seguro', Number.MAX_SAFE_INTEGER],
    ['el mayor entero seguro, escrito', String(Number.MAX_SAFE_INTEGER)],
  ] as const;

  it.each([
    ['stock', MENSAJES.stockTope],
    ['stockMinimo', MENSAJES.minimoTope],
  ])(
    '[D-2] el tope del campo %s se acepta y lo que lo pasa se rechaza con su mensaje',
    (campo, mensaje) => {
      expect(validarRecambio({ ...RECAMBIO, [campo]: TOPE }).ok).toBe(true);
      expect(validarRecambio({ ...RECAMBIO, [campo]: String(TOPE) }).ok).toBe(true);
      DEMASIADO.forEach(([, valor]) => {
        expect(validarRecambio({ ...RECAMBIO, [campo]: valor })).toEqual(
          fallo({ [campo]: mensaje }),
        );
      });
    },
  );

  it.each([
    ['un texto de veinte cifras', '99999999999999999999'],
    ['un número que ya no es un entero seguro', 1e21],
  ])('[D-2] %s se rechaza con el mensaje del campo', (_caso, valor) => {
    expect(validarRecambio({ ...RECAMBIO, stock: valor })).toEqual(
      fallo({ stock: MENSAJES.entero }),
    );
  });

  it('[D-2] el stock y el mínimo que pasan el tope se explican a la vez, cada uno con su mensaje', () => {
    const resultado = validarRecambio({ ...RECAMBIO, stock: TOPE + 1, stockMinimo: TOPE + 1 });

    expect(resultado).toEqual(
      fallo({ stock: MENSAJES.stockTope, stockMinimo: MENSAJES.minimoTope }),
    );
  });
});

describe('validarRecambio, tope del precio', () => {
  it.each([
    ['en el tope exacto', '21474836,47', TOPE],
    ['con un solo decimal', '21474836,4', 2_147_483_640],
  ])('[D-5] un precio %s son %i céntimos y se acepta', (_caso, escrito, centimos) => {
    expect(validarRecambio({ ...RECAMBIO, precio: escrito })).toMatchObject({
      ok: true,
      datos: { precioCentimos: centimos },
    });
  });

  it.each([
    ['un céntimo por encima del tope', '21474836,48'],
    ['doce cifras', '999999999999'],
    ['una cifra por encima', '214748364,7'],
  ])('[D-2] un precio %s se rechaza con el mensaje del tope', (_caso, escrito) => {
    expect(validarRecambio({ ...RECAMBIO, precio: escrito })).toEqual(
      fallo({ precio: MENSAJES.precioTope }),
    );
  });

  it('[D-2] un precio imposible de contar en céntimos exactos sigue siendo «no válido»', () => {
    const escrito = '9'.repeat(30);

    expect(validarRecambio({ ...RECAMBIO, precio: escrito })).toEqual(
      fallo({ precio: MENSAJES.precio }),
    );
  });
});

describe('validarRecambio, el tope y el cero', () => {
  it('[D-2] cualquier entero por encima del tope se rechaza y cualquiera hasta el tope se acepta', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: TOPE + 1, max: Number.MAX_SAFE_INTEGER }),
        fc.integer({ min: 0, max: TOPE }),
        (demasiado, valido) => {
          expect(validarRecambio({ ...RECAMBIO, stock: demasiado })).toEqual(
            fallo({ stock: MENSAJES.stockTope }),
          );
          expect(validarRecambio({ ...RECAMBIO, stock: valido }).ok).toBe(true);
        },
      ),
    );
  });

  it('un valor por debajo de cero sigue explicándose con el mensaje de siempre, no con el del tope', () => {
    const resultado = validarRecambio({ ...RECAMBIO, stock: -1, stockMinimo: -TOPE });

    expect(resultado).toEqual(fallo({ stock: MENSAJES.entero, stockMinimo: MENSAJES.entero }));
  });
});

describe('validarRecambio, id del recambio que se edita', () => {
  it('sin id es un alta y los datos salen sin id', () => {
    const resultado = validarRecambio(RECAMBIO);

    expect(resultado.ok && 'id' in resultado.datos).toBe(false);
  });

  it('con el id de un recambio (uuid) es una edición y el id sale con los datos', () => {
    const resultado = validarRecambio({ ...RECAMBIO, id: ID_RECAMBIO });

    expect(resultado).toMatchObject({ ok: true, datos: { id: ID_RECAMBIO, referencia: 'FIL-01' } });
  });

  it.each([
    ['vacío', ''],
    ['un texto cualquiera', 'basura'],
    ['un uuid con una cifra de menos', '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7b6'],
    ['un uuid con letras que no son hexadecimales', '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7bzz'],
    ['diez mil caracteres', 'a'.repeat(10_000)],
    ['un número', 12],
    ['nulo', null],
    ['una lista', [ID_RECAMBIO]],
  ])('[D-2] un id %s no es un uuid y se rechaza', (_caso, id) => {
    expect(validarRecambio({ ...RECAMBIO, id })).toEqual(fallo({ id: MENSAJES.id }));
  });

  it('[D-2] un id roto no impide explicar a la vez los campos mal escritos', () => {
    const resultado = validarRecambio({ ...RECAMBIO, id: 'basura', stock: -1 });

    expect(resultado).toEqual(fallo({ id: MENSAJES.id, stock: MENSAJES.entero }));
  });
});
