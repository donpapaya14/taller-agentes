import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guardar } from './acciones';

const { guardarRecambio, leerSesion, redirect, revalidatePath } = vi.hoisted(() => ({
  guardarRecambio: vi.fn(),
  leerSesion: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/adaptadores/supabase/sesion', () => ({ leerSesion }));
vi.mock('@/adaptadores/supabase/recambios', () => ({ guardarRecambio }));

const ID_RECAMBIO = '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7b64';
const ID_TALLER = '1b7e4c9a-2d5f-4a3b-8c6d-9e0f1a2b3c4d';

const JEFE = { usuarioId: 'u-1', tallerId: ID_TALLER, taller: 'Taller Demo', rol: 'jefe' };
const MECANICO = { ...JEFE, rol: 'mecanico' };

const CAMPOS = {
  referencia: 'fil-01',
  nombre: 'Filtro de aceite',
  precio: '12,50',
  stock: '5',
  stockMinimo: '2',
};

// Lo que manda el navegador al enviar el formulario: cada campo con su valor.
function datosDe(campos: Record<string, string | File>): FormData {
  const datos = new FormData();
  for (const [nombre, valor] of Object.entries(campos)) datos.set(nombre, valor);
  return datos;
}

// El primer argumento es el estado anterior del formulario: la acción no lo usa.
const guardarCon = (campos: Record<string, string | File> = CAMPOS) =>
  guardar(null, datosDe(campos));

const NO_SE_PUDO = 'No se pudo guardar el recambio. Inténtalo de nuevo.';

beforeEach(() => {
  leerSesion.mockResolvedValue(JEFE);
  guardarRecambio.mockResolvedValue({ ok: true });
  // El redirect de Next lanza para cortar la acción en seco; este lo imita para que lo que sigue
  // a un redirect no llegue a ejecutarse.
  redirect.mockImplementation((destino: string) => {
    throw new Error(`REDIRIGE:${destino}`);
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('guardar: quién puede', () => {
  it('[C-1] sin sesión redirige a /login antes de tocar ningún dato', async () => {
    leerSesion.mockResolvedValue(null);

    await expect(guardarCon()).rejects.toThrow('REDIRIGE:/login');

    expect(guardarRecambio).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('[C-3] el mecánico no llega al repositorio y se le dice por qué', async () => {
    leerSesion.mockResolvedValue(MECANICO);

    const estado = await guardarCon();

    expect(estado).toEqual({
      ok: false,
      motivo: 'Solo el jefe de taller puede editar el almacén',
      errores: {},
      valores: CAMPOS,
    });
    expect(guardarRecambio).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('[D-14] si no se puede leer la sesión, el fallo llega a la pantalla de error', async () => {
    leerSesion.mockRejectedValue(new Error('No se pudo cargar tu taller. Inténtalo más tarde.'));

    await expect(guardarCon()).rejects.toThrow('No se pudo cargar tu taller');

    expect(guardarRecambio).not.toHaveBeenCalled();
  });
});

describe('guardar: lo que guarda', () => {
  it('[C-3] el jefe guarda un recambio nuevo en su taller y se refresca el almacén', async () => {
    const estado = await guardarCon();

    expect(estado).toEqual({ ok: true });
    expect(guardarRecambio).toHaveBeenCalledExactlyOnceWith(
      {
        referencia: 'FIL-01',
        nombre: 'Filtro de aceite',
        precioCentimos: 1250,
        stock: 5,
        stockMinimo: 2,
      },
      ID_TALLER,
    );
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/recambios');
  });

  it('[C-6] el jefe edita el recambio cuyo id manda el formulario', async () => {
    const estado = await guardarCon({ ...CAMPOS, id: ID_RECAMBIO, stock: '1' });

    expect(estado).toEqual({ ok: true });
    expect(guardarRecambio).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: ID_RECAMBIO, stock: 1 }),
      ID_TALLER,
    );
  });
});

describe('guardar: lo que no pasa la validación', () => {
  it('[D-2] un formulario con errores no llega al repositorio y devuelve lo escrito', async () => {
    const campos = { ...CAMPOS, referencia: 'a', stock: '-1' };

    const estado = await guardarCon(campos);

    expect(estado).toEqual({
      ok: false,
      motivo: 'Revisa los campos con error',
      errores: {
        referencia: 'La referencia tiene entre 2 y 20 caracteres',
        stock: 'Tiene que ser un número entero, cero o más',
      },
      valores: campos,
    });
    expect(guardarRecambio).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('[D-2] un id que no es un uuid no llega al repositorio', async () => {
    const estado = await guardarCon({ ...CAMPOS, id: 'no-es-un-uuid' });

    expect(estado).toMatchObject({
      ok: false,
      motivo: 'No se reconoce el recambio. Recarga la página',
    });
    expect(guardarRecambio).not.toHaveBeenCalled();
  });

  it('[D-2] un archivo donde se espera un número es un campo mal escrito y no se devuelve', async () => {
    const archivo = new File(['x'], 'stock.txt');

    const estado = await guardarCon({ ...CAMPOS, stock: archivo });

    expect(estado).toEqual({
      ok: false,
      motivo: 'Revisa los campos con error',
      errores: { stock: 'Tiene que ser un número entero, cero o más' },
      valores: {
        referencia: CAMPOS.referencia,
        nombre: CAMPOS.nombre,
        precio: CAMPOS.precio,
        stockMinimo: CAMPOS.stockMinimo,
      },
    });
    expect(guardarRecambio).not.toHaveBeenCalled();
  });
});

describe('guardar: un nombre que no cabe', () => {
  it('[D-14] un nombre de catálogo de más de 80 caracteres dice el rango y se devuelve entero', async () => {
    const nombre =
      'Pastillas de freno delanteras Bosch 0 986 494 xxx para Seat León 1.6 TDI 2012-2019 juego de cuatro';

    const estado = await guardarCon({ ...CAMPOS, nombre });

    expect(estado).toEqual({
      ok: false,
      motivo: 'Revisa los campos con error',
      errores: { nombre: 'El nombre tiene entre 2 y 80 caracteres' },
      valores: { ...CAMPOS, nombre },
    });
    expect(guardarRecambio).not.toHaveBeenCalled();
  });
});

describe('guardar: lo que rechaza el repositorio', () => {
  it('[D-14] una referencia repetida se dice junto a su campo y no se refresca nada', async () => {
    guardarRecambio.mockResolvedValue({ ok: false, motivo: 'referencia_repetida' });

    const estado = await guardarCon();

    expect(estado).toEqual({
      ok: false,
      motivo: 'Revisa los campos con error',
      errores: { referencia: 'Ya hay un recambio con esa referencia' },
      valores: CAMPOS,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('[D-14] un recambio que no se encontró o no se puede editar se explica sin marcar campos', async () => {
    guardarRecambio.mockResolvedValue({ ok: false, motivo: 'sin_permiso_o_no_encontrado' });

    const estado = await guardarCon({ ...CAMPOS, id: ID_RECAMBIO });

    expect(estado).toMatchObject({
      ok: false,
      motivo:
        'No se pudo guardar el recambio. Puede que ya no exista o que no tengas permiso para editarlo.',
      errores: {},
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('guardar: cuando el repositorio falla', () => {
  it.each([
    [
      'un error con el texto técnico de Postgres',
      new Error(
        'duplicate key value violates unique constraint "recambios_taller_id_referencia_key"',
      ),
    ],
    ['un error de red', new TypeError('fetch failed')],
    ['algo que ni siquiera es un error', 'se cayó'],
  ])('[D-14] %s se devuelve como un motivo en español, sin lanzar', async (_caso, fallo) => {
    guardarRecambio.mockRejectedValue(fallo);

    const estado = await guardarCon();

    expect(estado).toEqual({ ok: false, motivo: NO_SE_PUDO, errores: {}, valores: CAMPOS });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('[D-14] el redirect de Next no se confunde con un fallo del repositorio', async () => {
    leerSesion.mockResolvedValue(null);
    guardarRecambio.mockRejectedValue(new Error('no debería llamarse'));

    await expect(guardarCon()).rejects.toThrow('REDIRIGE:/login');
  });
});

describe('guardar: lo que devuelve al formulario', () => {
  it('[D-2] solo devuelve los campos del formulario, no los que Next añade a la petición', async () => {
    const estado = await guardarCon({
      ...CAMPOS,
      stock: 'x',
      $ACTION_REF_1: '',
      '$ACTION_1:0': '{"id":"abc","bound":"$@1"}',
      $ACTION_KEY: 'k',
    });

    expect(estado).toEqual({
      ok: false,
      motivo: 'Revisa los campos con error',
      errores: { stock: 'Tiene que ser un número entero, cero o más' },
      valores: { ...CAMPOS, stock: 'x' },
    });
  });
});
