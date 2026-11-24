import { describe, expect, it, vi } from 'vitest';
import { guardarFormularioDeRecambio } from './recambios';

const ID_RECAMBIO = '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7b64';
const ID_TALLER = '1b7e4c9a-2d5f-4a3b-8c6d-9e0f1a2b3c4d';

const FORMULARIO = {
  referencia: 'fil-01',
  nombre: 'Filtro de aceite',
  precio: '12,50',
  stock: '5',
  stockMinimo: '2',
};

const DATOS = {
  referencia: 'FIL-01',
  nombre: 'Filtro de aceite',
  precioCentimos: 1250,
  stock: 5,
  stockMinimo: 2,
};

const REVISA = 'Revisa los campos con error';
const NO_SE_PUDO =
  'No se pudo guardar el recambio. Puede que ya no exista o que no tengas permiso para editarlo.';

// El puerto es el repositorio de recambios: aquí contesta lo que se le diga.
const puertoQue = (respuesta: unknown) => ({
  guardarRecambio: vi.fn().mockResolvedValue(respuesta),
});

const guardado = { ok: true };
const rechazo = (motivo: string) => ({ ok: false, motivo });

describe('guardarFormularioDeRecambio: lo que guarda', () => {
  it('[C-3] un recambio nuevo se valida, se normaliza y se guarda en el taller de quien lo manda', async () => {
    const puerto = puertoQue(guardado);

    const resultado = await guardarFormularioDeRecambio(FORMULARIO, ID_TALLER, puerto);

    expect(resultado).toEqual({ ok: true });
    expect(puerto.guardarRecambio).toHaveBeenCalledExactlyOnceWith(DATOS, ID_TALLER);
  });

  it('[C-3] con el id de un recambio edita ese recambio', async () => {
    const puerto = puertoQue(guardado);

    const resultado = await guardarFormularioDeRecambio(
      { ...FORMULARIO, id: ID_RECAMBIO },
      ID_TALLER,
      puerto,
    );

    expect(resultado).toEqual({ ok: true });
    expect(puerto.guardarRecambio).toHaveBeenCalledExactlyOnceWith(
      { ...DATOS, id: ID_RECAMBIO },
      ID_TALLER,
    );
  });
});

describe('guardarFormularioDeRecambio: lo que no llega a guardarse', () => {
  it('[D-2] un formulario con errores no llega al repositorio y explica cada campo', async () => {
    const puerto = puertoQue(guardado);

    const resultado = await guardarFormularioDeRecambio(
      { ...FORMULARIO, referencia: 'a', stock: '-1' },
      ID_TALLER,
      puerto,
    );

    expect(resultado).toEqual({
      ok: false,
      motivo: REVISA,
      errores: {
        referencia: 'La referencia tiene entre 2 y 20 caracteres',
        stock: 'Tiene que ser un número entero, cero o más',
      },
    });
    expect(puerto.guardarRecambio).not.toHaveBeenCalled();
  });

  it('[D-2] un id que no es un uuid no llega al repositorio y el motivo lo dice', async () => {
    const puerto = puertoQue(guardado);

    const resultado = await guardarFormularioDeRecambio(
      { ...FORMULARIO, id: "1'; drop table recambios; --" },
      ID_TALLER,
      puerto,
    );

    expect(resultado).toEqual({
      ok: false,
      motivo: 'No se reconoce el recambio. Recarga la página',
      errores: { id: 'No se reconoce el recambio. Recarga la página' },
    });
    expect(puerto.guardarRecambio).not.toHaveBeenCalled();
  });

  it.each([
    ['null', null],
    ['un texto', 'x'],
    ['un número', 5],
    ['una lista', [FORMULARIO]],
  ])(
    '[D-2] una entrada que no es un objeto (%s) no llega al repositorio',
    async (_caso, entrada) => {
      const puerto = puertoQue(guardado);

      const resultado = await guardarFormularioDeRecambio(entrada, ID_TALLER, puerto);

      expect(resultado.ok).toBe(false);
      expect(puerto.guardarRecambio).not.toHaveBeenCalled();
    },
  );
});

describe('guardarFormularioDeRecambio: un nombre que no cabe', () => {
  it('[D-14] un nombre de más de 80 caracteres no llega al repositorio y dice el rango', async () => {
    const puerto = puertoQue(guardado);

    const resultado = await guardarFormularioDeRecambio(
      { ...FORMULARIO, nombre: 'x'.repeat(98) },
      ID_TALLER,
      puerto,
    );

    expect(resultado).toEqual({
      ok: false,
      motivo: REVISA,
      errores: { nombre: 'El nombre tiene entre 2 y 80 caracteres' },
    });
    expect(puerto.guardarRecambio).not.toHaveBeenCalled();
  });
});

describe('guardarFormularioDeRecambio: lo que el repositorio rechaza', () => {
  it('[D-14] una referencia repetida se dice junto al campo de la referencia', async () => {
    const puerto = puertoQue(rechazo('referencia_repetida'));

    const resultado = await guardarFormularioDeRecambio(FORMULARIO, ID_TALLER, puerto);

    expect(resultado).toEqual({
      ok: false,
      motivo: REVISA,
      errores: { referencia: 'Ya hay un recambio con esa referencia' },
    });
  });

  it('[C-3][D-14] sin permiso o recambio que no existe se explica sin marcar ningún campo', async () => {
    const puerto = puertoQue(rechazo('sin_permiso_o_no_encontrado'));

    const resultado = await guardarFormularioDeRecambio(
      { ...FORMULARIO, id: ID_RECAMBIO },
      ID_TALLER,
      puerto,
    );

    expect(resultado).toEqual({ ok: false, motivo: NO_SE_PUDO, errores: {} });
  });

  it('[D-14] el fallo del repositorio no se traga: llega a quien lo llama, que lo explica', async () => {
    const puerto = { guardarRecambio: vi.fn().mockRejectedValue(new Error('se cayó')) };

    await expect(guardarFormularioDeRecambio(FORMULARIO, ID_TALLER, puerto)).rejects.toThrow(
      'se cayó',
    );
  });
});
