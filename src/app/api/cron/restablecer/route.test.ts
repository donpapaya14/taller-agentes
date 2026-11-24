import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { leerEntornoSecreto } from '@/adaptadores/supabase/entorno-secreto';
import { conPlazoTotal, PLAZO_TOTAL_MS } from '@/adaptadores/supabase/tiempo-limite';
import { USUARIOS_DEMO } from '@/aplicacion/acceso';
import { GET } from './route';

const { rpcRestablecer, reponerContrasenas } = vi.hoisted(() => ({
  rpcRestablecer: vi.fn(),
  reponerContrasenas: vi.fn(),
}));

// `server-only` lanza fuera de un componente de servidor de Next; aquí solo hay que dejarlo pasar.
vi.mock('server-only', () => ({}));
vi.mock('@/adaptadores/supabase/demo', () => ({ rpcRestablecer, reponerContrasenas }));
// La lectura del entorno es la de verdad, pero espiada para poder hacerla fallar en un test.
vi.mock('@/adaptadores/supabase/entorno-secreto', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/adaptadores/supabase/entorno-secreto')>();
  return { ...original, leerEntornoSecreto: vi.fn(original.leerEntornoSecreto) };
});
// Igual con el plazo: el de verdad, espiado para poder hacerlo fallar de un modo que no es vencer.
vi.mock('@/adaptadores/supabase/tiempo-limite', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/adaptadores/supabase/tiempo-limite')>();
  return { ...original, conPlazoTotal: vi.fn(original.conPlazoTotal) };
});

const SECRETO = 'secreto del cron de prueba';

beforeEach(() => {
  vi.stubEnv('SUPABASE_SECRET_KEY', 'clave secreta de prueba');
  vi.stubEnv('CRON_SECRET', SECRETO);
  vi.stubEnv('DEMO_PASSWORD', 'contraseña de demostración de prueba');
  reponerContrasenas.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

const peticion = (autorizacion?: string) =>
  new Request('https://foso.example/api/cron/restablecer', {
    headers: autorizacion === undefined ? {} : { authorization: autorizacion },
  });

// Quien no está autorizado recibe un 401 y no se restablece ni se repone nada.
async function seRechaza(autorizacion?: string): Promise<void> {
  const respuesta = await GET(peticion(autorizacion));

  expect(respuesta.status).toBe(401);
  expect(await respuesta.json()).toEqual({ error: 'No autorizado' });
  expect(rpcRestablecer).not.toHaveBeenCalled();
  expect(reponerContrasenas).not.toHaveBeenCalled();
}

describe('GET /api/cron/restablecer', () => {
  it('[C-13] sin cabecera responde 401', () => seRechaza());

  it('[C-13] con secreto incorrecto responde 401 sin restablecer nada', () =>
    seRechaza('Bearer otro'));

  it('[C-13] con el secreto correcto restablece, repone las contraseñas y responde 200', async () => {
    rpcRestablecer.mockResolvedValue('RESTABLECIDO');

    const respuesta = await GET(peticion(`Bearer ${SECRETO}`));

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ estado: 'RESTABLECIDO' });
    expect(reponerContrasenas).toHaveBeenCalledTimes(1);
    expect(reponerContrasenas).toHaveBeenCalledWith(
      Object.values(USUARIOS_DEMO),
      expect.any(AbortSignal),
    );
  });

  it('[C-13] si hubo otro restablecimiento hace poco responde 200 EN_ESPERA y no toca nada más', async () => {
    rpcRestablecer.mockResolvedValue('EN_ESPERA');

    const respuesta = await GET(peticion(`Bearer ${SECRETO}`));

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ estado: 'EN_ESPERA' });
    expect(reponerContrasenas).not.toHaveBeenCalled();
  });

  it('[C-13][D-14] si falla responde 500 con un motivo que se entiende', async () => {
    rpcRestablecer.mockRejectedValue(new Error('connection refused'));

    const respuesta = await GET(peticion(`Bearer ${SECRETO}`));

    expect(respuesta.status).toBe(500);
    expect(await respuesta.json()).toEqual({
      estado: 'ERROR',
      motivo: 'No se pudo restablecer la demo',
    });
  });
});

// Con Supabase caído las librerías reintentan durante unos 25 s: el cron responde mucho antes.
describe('GET /api/cron/restablecer: el plazo', () => {
  it('[C-13][D-14] las dos llamadas a Supabase comparten la señal del plazo', async () => {
    rpcRestablecer.mockResolvedValue('RESTABLECIDO');

    await GET(peticion(`Bearer ${SECRETO}`));

    const [plazoDeLaBase] = rpcRestablecer.mock.calls[0];
    const [, plazoDeAuth] = reponerContrasenas.mock.calls[0];
    expect(plazoDeLaBase).toBeInstanceOf(AbortSignal);
    expect(plazoDeAuth).toBe(plazoDeLaBase);
    expect(plazoDeLaBase.aborted).toBe(false);
  });

  it('[C-13][D-14] si Supabase no contesta a tiempo responde 500 con su motivo y corta lo que quedaba', async () => {
    vi.useFakeTimers();
    rpcRestablecer.mockReturnValue(new Promise(() => undefined));

    const respuesta = GET(peticion(`Bearer ${SECRETO}`));
    await vi.advanceTimersByTimeAsync(PLAZO_TOTAL_MS);

    const resultado = await respuesta;
    expect(resultado.status).toBe(500);
    expect(await resultado.json()).toEqual({
      estado: 'ERROR',
      motivo: 'La base de datos no contestó a tiempo',
    });
    expect(rpcRestablecer.mock.calls[0][0].aborted).toBe(true);
    expect(reponerContrasenas).not.toHaveBeenCalled();
  });

  it('[C-13][D-14] con las contraseñas colgadas también corta y responde 500', async () => {
    vi.useFakeTimers();
    rpcRestablecer.mockResolvedValue('RESTABLECIDO');
    reponerContrasenas.mockReturnValue(new Promise(() => undefined));

    const respuesta = GET(peticion(`Bearer ${SECRETO}`));
    await vi.advanceTimersByTimeAsync(PLAZO_TOTAL_MS);

    expect((await respuesta).status).toBe(500);
  });

  it('[C-13] lo que acaba antes del plazo no se corta', async () => {
    vi.useFakeTimers();
    rpcRestablecer.mockResolvedValue('EN_ESPERA');

    const respuesta = await GET(peticion(`Bearer ${SECRETO}`));

    expect(respuesta.status).toBe(200);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('GET /api/cron/restablecer: el entorno', () => {
  // Al resto del entorno se llega después de saber quién llama: quien manda el secreto correcto
  // puede enterarse de qué variable falta; un desconocido, no.
  it.each(['SUPABASE_SECRET_KEY', 'DEMO_PASSWORD'])(
    '[C-13][D-14] sin %s, quien manda el secreto correcto recibe 500 con la variable que falta',
    async (variable) => {
      vi.stubEnv(variable, '');

      const respuesta = await GET(peticion(`Bearer ${SECRETO}`));

      expect(respuesta.status).toBe(500);
      expect(await respuesta.json()).toEqual({ error: `Falta la variable de entorno ${variable}` });
      expect(rpcRestablecer).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['SUPABASE_SECRET_KEY', undefined],
    ['SUPABASE_SECRET_KEY', 'Bearer otro'],
    ['DEMO_PASSWORD', undefined],
    ['DEMO_PASSWORD', 'Bearer otro'],
  ])(
    '[C-13][D-14] sin %s, quien no manda el secreto correcto (%s) recibe 401 y no se entera de qué falta',
    (variable, autorizacion) => {
      vi.stubEnv(variable, '');

      return seRechaza(autorizacion);
    },
  );

  it.each([undefined, 'Bearer ', 'Bearer undefined', `Bearer ${SECRETO}`])(
    '[C-13] sin CRON_SECRET nadie pasa: la cabecera %s recibe 401',
    (autorizacion) => {
      vi.stubEnv('CRON_SECRET', '');

      return seRechaza(autorizacion);
    },
  );
});

// Lo que la ruta no sabe explicar se relanza: lo registra Next y la respuesta no cuenta el detalle.
describe('GET /api/cron/restablecer: un fallo inesperado', () => {
  it('[D-14] un fallo que no es del entorno no se esconde ni se cuenta en la respuesta', async () => {
    vi.mocked(leerEntornoSecreto).mockImplementationOnce(() => {
      throw new Error('detalle interno que no debe salir');
    });

    const respuesta = GET(peticion(`Bearer ${SECRETO}`));

    await expect(respuesta).rejects.toThrow('detalle interno que no debe salir');
    expect(rpcRestablecer).not.toHaveBeenCalled();
  });

  it('[D-14] un fallo del plazo que no es haberlo vencido tampoco se esconde', async () => {
    vi.mocked(conPlazoTotal).mockRejectedValueOnce(new Error('detalle interno del plazo'));

    const respuesta = GET(peticion(`Bearer ${SECRETO}`));

    await expect(respuesta).rejects.toThrow('detalle interno del plazo');
    expect(rpcRestablecer).not.toHaveBeenCalled();
  });
});
