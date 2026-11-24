import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { leerEntornoSecreto } from '@/adaptadores/supabase/entorno-secreto';
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

const SECRETO = 'secreto del cron de prueba';

beforeEach(() => {
  vi.stubEnv('SUPABASE_SECRET_KEY', 'clave secreta de prueba');
  vi.stubEnv('CRON_SECRET', SECRETO);
  vi.stubEnv('DEMO_PASSWORD', 'contraseña de demostración de prueba');
  reponerContrasenas.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

const peticion = (autorizacion?: string) =>
  new Request('https://foso.example/api/cron/restablecer', {
    headers: autorizacion === undefined ? {} : { authorization: autorizacion },
  });

describe('GET /api/cron/restablecer', () => {
  it('[C-13] sin cabecera responde 401', async () => {
    const respuesta = await GET(peticion());

    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toEqual({ error: 'No autorizado' });
    expect(rpcRestablecer).not.toHaveBeenCalled();
  });

  it('[C-13] con secreto incorrecto responde 401 sin restablecer nada', async () => {
    const respuesta = await GET(peticion('Bearer otro'));

    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toEqual({ error: 'No autorizado' });
    expect(rpcRestablecer).not.toHaveBeenCalled();
    expect(reponerContrasenas).not.toHaveBeenCalled();
  });

  it('[C-13] con el secreto correcto restablece, repone las contraseñas y responde 200', async () => {
    rpcRestablecer.mockResolvedValue('RESTABLECIDO');

    const respuesta = await GET(peticion(`Bearer ${SECRETO}`));

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ estado: 'RESTABLECIDO' });
    expect(reponerContrasenas).toHaveBeenCalledTimes(1);
    expect(reponerContrasenas).toHaveBeenCalledWith(Object.values(USUARIOS_DEMO));
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

describe('GET /api/cron/restablecer: el entorno', () => {
  it.each(['SUPABASE_SECRET_KEY', 'CRON_SECRET', 'DEMO_PASSWORD'])(
    '[D-14] sin %s responde 500 y dice qué variable falta, sin dejar pasar a nadie',
    async (variable) => {
      vi.stubEnv(variable, '');

      const respuesta = await GET(peticion(`Bearer ${SECRETO}`));

      expect(respuesta.status).toBe(500);
      expect(await respuesta.json()).toEqual({ error: `Falta la variable de entorno ${variable}` });
      expect(rpcRestablecer).not.toHaveBeenCalled();
    },
  );

  it('[D-14] un fallo que no es del entorno no se esconde ni se cuenta en la respuesta', async () => {
    vi.mocked(leerEntornoSecreto).mockImplementationOnce(() => {
      throw new Error('detalle interno que no debe salir');
    });

    const respuesta = GET(peticion(`Bearer ${SECRETO}`));

    await expect(respuesta).rejects.toThrow('detalle interno que no debe salir');
    expect(rpcRestablecer).not.toHaveBeenCalled();
  });
});
