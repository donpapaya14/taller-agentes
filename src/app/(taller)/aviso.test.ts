import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avisar, contarResultado, leerAviso, limpiarAviso, type Aviso } from './aviso';

const { almacen } = vi.hoisted(() => ({
  almacen: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
}));

vi.mock('next/headers', () => ({ cookies: async () => almacen }));

const NOMBRE = 'foso-aviso';

const conCookie = (valor: string | undefined) =>
  almacen.get.mockReturnValue(valor === undefined ? undefined : { name: NOMBRE, value: valor });

beforeEach(() => conCookie(undefined));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe('avisar', () => {
  const AVISO: Aviso = { tipo: 'error', texto: 'Otra persona ya movió esta orden. Recarga el tablero' };

  it('[D-14] guarda el aviso en una cookie que el navegador no puede leer y vive unos segundos', async () => {
    await avisar(AVISO);

    expect(almacen.set).toHaveBeenCalledTimes(1);
    const [nombre, valor, opciones] = almacen.set.mock.calls[0];
    expect(nombre).toBe(NOMBRE);
    expect(JSON.parse(valor)).toEqual(AVISO);
    expect(opciones).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 10 });
  });

  it('[D-14] la cookie solo viaja por https en producción', async () => {
    await avisar(AVISO);
    vi.stubEnv('NODE_ENV', 'production');
    await avisar(AVISO);

    expect(almacen.set.mock.calls.map((llamada) => llamada[2].secure)).toEqual([false, true]);
  });
});

describe('leerAviso', () => {
  it('[D-14] devuelve el aviso que dejó una acción', async () => {
    conCookie(JSON.stringify({ tipo: 'ok', texto: 'Orden entregada. Factura F-2026-0001' }));

    expect(await leerAviso()).toEqual({ tipo: 'ok', texto: 'Orden entregada. Factura F-2026-0001' });
    expect(almacen.get).toHaveBeenCalledWith(NOMBRE);
  });

  it('[D-14] sin cookie no hay aviso', async () => {
    expect(await leerAviso()).toBeNull();
  });

  it.each([
    ['texto que no es JSON', 'no soy json'],
    ['JSON sin forma de aviso', '{"hola":1}'],
    ['un tipo que no existe', '{"tipo":"peligro","texto":"Cuidado"}'],
    ['un texto vacío', '{"tipo":"error","texto":""}'],
    ['un texto larguísimo', JSON.stringify({ tipo: 'error', texto: 'a'.repeat(301) })],
    ['campos de más', '{"tipo":"ok","texto":"Hecho","extra":true}'],
    ['un valor que no es un objeto', '"error"'],
    ['null', 'null'],
  ])('[D-2] una cookie con %s no es un aviso', async (_caso, valor) => {
    conCookie(valor);

    expect(await leerAviso()).toBeNull();
  });

  it('[D-2] con cualquier texto en la cookie no lanza: o es un aviso entero o no es nada', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (valor) => {
        conCookie(valor);

        const aviso = await leerAviso();

        expect(aviso === null || ['ok', 'error'].includes(aviso.tipo)).toBe(true);
      }),
    );
  });
});

describe('limpiarAviso', () => {
  it('[D-14] borra la cookie del aviso anterior', async () => {
    await limpiarAviso();

    expect(almacen.delete).toHaveBeenCalledExactlyOnceWith(NOMBRE);
  });
});

describe('contarResultado', () => {
  const MOTIVO_SI_LANZA = 'No se pudo mover la orden. Inténtalo de nuevo.';

  const avisosGuardados = () => almacen.set.mock.calls.map(([, valor]) => JSON.parse(valor));

  it('[D-14] lo que sale bien y no tiene nada que contar no deja ningún aviso', async () => {
    await contarResultado(async () => ({ ok: true }), MOTIVO_SI_LANZA);

    expect(almacen.set).not.toHaveBeenCalled();
  });

  it('[D-14] lo que sale bien y tiene algo que contar lo deja como confirmación', async () => {
    await contarResultado(
      async () => ({ ok: true, aviso: 'Orden entregada. Factura F-2026-0001' }),
      MOTIVO_SI_LANZA,
    );

    expect(avisosGuardados()).toEqual([
      { tipo: 'ok', texto: 'Orden entregada. Factura F-2026-0001' },
    ]);
  });

  it('[D-14] lo que no sale bien deja su motivo como error', async () => {
    await contarResultado(
      async () => ({ ok: false, motivo: 'Ese cambio de estado no está permitido' }),
      MOTIVO_SI_LANZA,
    );

    expect(avisosGuardados()).toEqual([
      { tipo: 'error', texto: 'Ese cambio de estado no está permitido' },
    ]);
  });

  it('[D-14] una excepción del repositorio no llega a la pantalla de error: se cuenta como motivo', async () => {
    const lanza = async () => {
      throw new Error('connection refused');
    };

    await expect(contarResultado(lanza, MOTIVO_SI_LANZA)).resolves.toBeUndefined();

    expect(avisosGuardados()).toEqual([{ tipo: 'error', texto: MOTIVO_SI_LANZA }]);
  });

  it('[D-14] el texto de la excepción no sale en el aviso: puede ser inglés o nombrar la base de datos', async () => {
    const lanza = async () => {
      throw new Error('password authentication failed for user "postgres"');
    };

    await contarResultado(lanza, MOTIVO_SI_LANZA);

    expect(JSON.stringify(avisosGuardados())).not.toContain('postgres');
  });
});
