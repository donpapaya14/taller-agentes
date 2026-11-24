import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validarNuevaOrden } from './nueva-orden';

const VEHICULO_ID = '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7b64';

const MENSAJES = {
  matricula: 'Matrícula no válida. Ejemplo: 1234 BCD',
  clienteTelefono: 'Teléfono no válido. Nueve cifras, por ejemplo 612 345 678',
  descripcion: 'Describe la avería o el trabajo (entre 5 y 500 letras)',
  clienteNombre: 'Falta el nombre del cliente',
  marca: 'Falta la marca',
  modelo: 'Falta el modelo',
  vehiculoId: 'Elige un vehículo',
};

const VEHICULO_EXISTENTE = { vehiculoId: VEHICULO_ID, descripcion: 'Cambio de aceite' };

const VEHICULO_NUEVO = {
  descripcion: 'Cambio de aceite',
  matricula: '1234 bcd',
  marca: 'Seat',
  modelo: 'Ibiza',
  clienteNombre: 'Marta Ruiz',
  clienteTelefono: '612 345 678',
};

const fallo = (errores: Record<string, string>) => ({ ok: false, errores });

describe('validarNuevaOrden con un vehículo que ya existe', () => {
  it('[C-11] acepta vehículo existente con descripción', () => {
    expect(validarNuevaOrden(VEHICULO_EXISTENTE)).toEqual({ ok: true, datos: VEHICULO_EXISTENTE });
  });

  it('[C-11] si hay vehículo elegido, los datos del vehículo nuevo se ignoran', () => {
    const resultado = validarNuevaOrden({ ...VEHICULO_NUEVO, vehiculoId: VEHICULO_ID });

    expect(resultado).toEqual({ ok: true, datos: VEHICULO_EXISTENTE });
  });

  it.each(['', '   ', 'no-es-un-uuid', 42, null])(
    '[C-11][D-2] pide elegir vehículo si el valor es %j',
    (vehiculoId) => {
      const resultado = validarNuevaOrden({ vehiculoId, descripcion: 'Cambio de aceite' });

      expect(resultado).toEqual(fallo({ vehiculoId: MENSAJES.vehiculoId }));
    },
  );

  it('[C-11] pide elegir vehículo cuando no se da ningún dato de vehículo', () => {
    expect(validarNuevaOrden({ descripcion: 'Cambio de aceite' })).toEqual(
      fallo({ vehiculoId: MENSAJES.vehiculoId }),
    );
  });
});

describe('validarNuevaOrden con vehículo y cliente nuevos', () => {
  it('[C-11] acepta vehículo y cliente nuevos y normaliza', () => {
    expect(validarNuevaOrden(VEHICULO_NUEVO)).toEqual({
      ok: true,
      datos: { ...VEHICULO_NUEVO, matricula: '1234BCD', clienteTelefono: '34612345678' },
    });
  });

  it('[C-11][D-2] explica cada error junto a su campo', () => {
    const resultado = validarNuevaOrden({
      ...VEHICULO_NUEVO,
      matricula: '12',
      clienteTelefono: '1',
      descripcion: 'a',
      clienteNombre: '',
    });

    expect(resultado).toEqual(
      fallo({
        matricula: MENSAJES.matricula,
        clienteTelefono: MENSAJES.clienteTelefono,
        descripcion: MENSAJES.descripcion,
        clienteNombre: MENSAJES.clienteNombre,
      }),
    );
  });

  it('[C-11] recorta los espacios de los textos', () => {
    const resultado = validarNuevaOrden({
      ...VEHICULO_NUEVO,
      descripcion: '  Cambio de aceite  ',
      marca: ' Seat ',
      clienteNombre: '  Marta Ruiz ',
    });

    expect(resultado).toMatchObject({
      ok: true,
      datos: { descripcion: 'Cambio de aceite', marca: 'Seat', clienteNombre: 'Marta Ruiz' },
    });
  });
});

describe('validarNuevaOrden con el vehículo nuevo a medias', () => {
  it('[C-11] pide la marca y el modelo cuando faltan o van en blanco', () => {
    const resultado = validarNuevaOrden({ ...VEHICULO_NUEVO, marca: '   ', modelo: undefined });

    expect(resultado).toEqual(fallo({ marca: MENSAJES.marca, modelo: MENSAJES.modelo }));
  });

  it('[C-11] pide lo que falta, no un vehículo existente', () => {
    const resultado = validarNuevaOrden({
      vehiculoId: '',
      descripcion: 'Cambio de aceite',
      clienteNombre: 'Marta Ruiz',
    });

    expect(resultado).toEqual(
      fallo({
        matricula: MENSAJES.matricula,
        marca: MENSAJES.marca,
        modelo: MENSAJES.modelo,
        clienteTelefono: MENSAJES.clienteTelefono,
      }),
    );
  });
});

// Marca, modelo y nombre sin tope llegarían enteros a la base de datos y a las tarjetas del tablero.
describe('validarNuevaOrden, topes de longitud', () => {
  const conCampo = (campo: string, texto: string) =>
    validarNuevaOrden({ ...VEHICULO_NUEVO, [campo]: texto });

  it.each([
    ['marca', 40, 'La marca tiene como máximo 40 caracteres'],
    ['modelo', 40, 'El modelo tiene como máximo 40 caracteres'],
    ['clienteNombre', 80, 'El nombre tiene como máximo 80 caracteres'],
  ])('[C-11][D-2] %s admite %i caracteres y rechaza uno más', (campo, tope, mensaje) => {
    expect(conCampo(campo, 'a'.repeat(tope))).toMatchObject({ ok: true });
    expect(conCampo(campo, 'a'.repeat(tope + 1))).toEqual(fallo({ [campo]: mensaje }));
  });

  it('[C-11] el tope cuenta el texto sin los espacios de los lados', () => {
    expect(conCampo('marca', ` ${'a'.repeat(40)} `)).toMatchObject({ ok: true });
  });

  it('[C-11] un campo vacío sigue pidiendo el dato, no hablando del tope', () => {
    expect(conCampo('marca', '   ')).toEqual(fallo({ marca: MENSAJES.marca }));
  });
});

describe('validarNuevaOrden, descripción', () => {
  const conDescripcion = (descripcion: unknown) =>
    validarNuevaOrden({ ...VEHICULO_EXISTENTE, descripcion });

  it.each([
    ['cinco letras', 'abcde'],
    ['quinientas letras', 'a'.repeat(500)],
    ['cinco letras entre espacios', '   abcde   '],
  ])('[C-11] acepta %s', (_nombre, descripcion) => {
    expect(conDescripcion(descripcion)).toMatchObject({ ok: true });
  });

  it.each([
    ['cuatro letras', 'abcd'],
    ['cinco caracteres con espacios que no cuentan', 'ab   '],
    ['quinientas una letras', 'a'.repeat(501)],
    ['nada', undefined],
    ['un número', 12345678],
  ])('[C-11][D-2] rechaza %s', (_nombre, descripcion) => {
    expect(conDescripcion(descripcion)).toEqual(fallo({ descripcion: MENSAJES.descripcion }));
  });
});

describe('validarNuevaOrden, entrada que no es un formulario', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['un texto', 'x'],
    ['un número', 42],
    ['un booleano', true],
    ['una lista vacía', []],
    ['una lista con un formulario dentro', [VEHICULO_NUEVO]],
  ])('[C-11][D-2] rechaza entrada que no es un objeto: %s', (_nombre, entrada) => {
    expect(validarNuevaOrden(entrada)).toEqual(
      fallo({ vehiculoId: MENSAJES.vehiculoId, descripcion: MENSAJES.descripcion }),
    );
  });

  it('[D-2] ninguna entrada hace lanzar al validador', () => {
    fc.assert(
      fc.property(fc.anything(), (entrada) => {
        expect(typeof validarNuevaOrden(entrada).ok).toBe('boolean');
      }),
    );
  });

  it('[D-2] un objeto con valores de cualquier tipo tampoco lo hace lanzar', () => {
    const valor = fc.anything();
    const campos = fc.record({
      descripcion: valor,
      vehiculoId: valor,
      matricula: valor,
      marca: valor,
      modelo: valor,
      clienteNombre: valor,
      clienteTelefono: valor,
    });

    fc.assert(
      fc.property(campos, (entrada) => {
        expect(typeof validarNuevaOrden(entrada).ok).toBe('boolean');
      }),
    );
  });
});

describe('validarNuevaOrden, normalización', () => {
  const CONSONANTES = [...'BCDFGHJKLMNPRSTVWXYZ'];
  const matriculaActual = fc
    .tuple(
      fc.integer({ min: 0, max: 9999 }),
      fc.array(fc.constantFrom(...CONSONANTES), { minLength: 3, maxLength: 3 }),
    )
    .map(([cifras, letras]) => `${String(cifras).padStart(4, '0')}${letras.join('')}`);

  it('[C-11] la matrícula sale igual escrita con espacios, guiones o minúsculas', () => {
    const escritura = fc.tuple(fc.constantFrom('', ' ', '-', '  '), fc.boolean());

    fc.assert(
      fc.property(matriculaActual, escritura, (matricula, [separador, minusculas]) => {
        const escrita = `${matricula.slice(0, 4)}${separador}${matricula.slice(4)}`;
        const resultado = validarNuevaOrden({
          ...VEHICULO_NUEVO,
          matricula: minusculas ? escrita.toLowerCase() : escrita,
        });

        expect(resultado).toMatchObject({ ok: true, datos: { matricula } });
      }),
    );
  });

  it('[C-11] el teléfono sale con prefijo 34 escrito con separadores o con prefijo', () => {
    const nueveCifras = fc
      .tuple(
        fc.constantFrom(6, 7, 8, 9),
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 8, maxLength: 8 }),
      )
      .map(([primera, resto]) => `${primera}${resto.join('')}`);
    const prefijo = fc.constantFrom('', '+34 ', '0034', '34');

    fc.assert(
      fc.property(nueveCifras, prefijo, (telefono, delante) => {
        const [a, b, c] = [telefono.slice(0, 3), telefono.slice(3, 6), telefono.slice(6)];
        const resultado = validarNuevaOrden({
          ...VEHICULO_NUEVO,
          clienteTelefono: `${delante}${a} ${b}-${c}`,
        });

        expect(resultado).toMatchObject({ ok: true, datos: { clienteTelefono: `34${telefono}` } });
      }),
    );
  });
});
