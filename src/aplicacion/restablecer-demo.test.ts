import * as crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { falloDeSupabase } from '../../tests/apoyo/fallos-falsos';
import { autorizado, restablecerDemo } from './restablecer-demo';

// Envuelve timingSafeEqual para ver si se usa; sigue haciendo lo mismo que el original.
vi.mock('node:crypto', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:crypto')>();
  return { ...original, timingSafeEqual: vi.fn(original.timingSafeEqual) };
});

const MOTIVO = 'No se pudo restablecer la demo';

// Un puerto cuyo restablecimiento responde `respuesta` (o falla, si es un Error). Con entrada
// basura la respuesta no es un texto: el tipo del puerto se miente aquí, a propósito.
function puertoQueResponde(respuesta: unknown) {
  const reponerContrasenas = vi.fn().mockResolvedValue(undefined);
  const rpcRestablecer = (() =>
    respuesta instanceof Error
      ? Promise.reject(respuesta)
      : Promise.resolve(respuesta)) as () => Promise<string>;
  return { puerto: { rpcRestablecer, reponerContrasenas }, reponerContrasenas };
}

// Quien pide con el secreto del cron es de confianza; quien pulsa el enlace del login no lo es.
const DEL_CRON = { reponerEnEspera: true };
const DE_UN_VISITANTE = { reponerEnEspera: false };

describe('restablecerDemo', () => {
  it('[C-13] con la base en espera repone las contraseñas si lo pide el cron', async () => {
    const { puerto, reponerContrasenas } = puertoQueResponde('EN_ESPERA');

    const resultado = await restablecerDemo(puerto, DEL_CRON);

    expect(resultado).toEqual({ estado: 'EN_ESPERA' });
    expect(reponerContrasenas).toHaveBeenCalledTimes(1);
  });

  it('[C-13] con la base en espera no repone las contraseñas si lo pide un visitante', async () => {
    const { puerto, reponerContrasenas } = puertoQueResponde('EN_ESPERA');

    const resultado = await restablecerDemo(puerto, DE_UN_VISITANTE);

    expect(resultado).toEqual({ estado: 'EN_ESPERA' });
    expect(reponerContrasenas).not.toHaveBeenCalled();
  });

  it.each([
    ['el cron', DEL_CRON],
    ['un visitante', DE_UN_VISITANTE],
  ])('[C-13] restablecido repone contraseñas también si lo pide %s', async (_quien, opciones) => {
    const { puerto, reponerContrasenas } = puertoQueResponde('RESTABLECIDO');

    const resultado = await restablecerDemo(puerto, opciones);

    expect(resultado).toEqual({ estado: 'RESTABLECIDO' });
    expect(reponerContrasenas).toHaveBeenCalledTimes(1);
  });
});

describe('restablecerDemo: cuando algo falla', () => {
  it('[C-13][D-14] con la base en espera, si el cron no puede reponer las contraseñas devuelve ERROR con mensaje', async () => {
    const { puerto, reponerContrasenas } = puertoQueResponde('EN_ESPERA');
    reponerContrasenas.mockRejectedValue(falloDeSupabase('Auth caído', 'unexpected_failure'));

    const resultado = await restablecerDemo(puerto, DEL_CRON);

    expect(resultado).toEqual({ estado: 'ERROR', motivo: MOTIVO });
  });

  it('[C-13][D-14] si la base de datos falla devuelve ERROR con mensaje', async () => {
    const { puerto, reponerContrasenas } = puertoQueResponde(
      falloDeSupabase('connection refused', '08006'),
    );

    const resultado = await restablecerDemo(puerto, DEL_CRON);

    expect(resultado).toEqual({ estado: 'ERROR', motivo: MOTIVO });
    expect(reponerContrasenas).not.toHaveBeenCalled();
  });

  it('[C-13][D-14] si no se pueden reponer las contraseñas devuelve ERROR con mensaje', async () => {
    const { puerto, reponerContrasenas } = puertoQueResponde('RESTABLECIDO');
    reponerContrasenas.mockRejectedValue(falloDeSupabase('Auth caído', 'unexpected_failure'));

    const resultado = await restablecerDemo(puerto, DE_UN_VISITANTE);

    expect(resultado).toEqual({ estado: 'ERROR', motivo: MOTIVO });
  });

  it.each([
    ['un texto que no es ninguno de los dos', 'OTRA_COSA'],
    ['el texto en minúsculas', 'restablecido'],
    ['el texto con espacios', ' RESTABLECIDO '],
    ['un texto vacío', ''],
    ['null', null],
    ['undefined', undefined],
    ['un número', 42],
    ['un objeto', { estado: 'RESTABLECIDO' }],
    ['una lista', ['RESTABLECIDO']],
  ])(
    '[C-13][D-2] si la base de datos responde %s devuelve ERROR y no repone nada',
    async (_caso, basura) => {
      const { puerto, reponerContrasenas } = puertoQueResponde(basura);

      const resultado = await restablecerDemo(puerto, DEL_CRON);

      expect(resultado).toEqual({ estado: 'ERROR', motivo: MOTIVO });
      expect(reponerContrasenas).not.toHaveBeenCalled();
    },
  );
});

// Lo que la aplicación no sabe contar no se esconde detrás de «No se pudo restablecer la demo»: se
// relanza tal cual para que Next lo registre y Vercel lo enseñe.
describe('restablecerDemo: un fallo inesperado', () => {
  const INESPERADOS = [
    ['un Error corriente', new Error('boom')],
    ['un TypeError', new TypeError('x is not a function')],
    ['un fallo de red de Supabase, con el código vacío', falloDeSupabase('fetch failed', '')],
  ] as const;

  it.each(INESPERADOS)(
    '[C-13][D-14] si la base falla con %s, se relanza y no repone nada',
    async (_caso, error) => {
      const { puerto, reponerContrasenas } = puertoQueResponde(error);

      await expect(restablecerDemo(puerto, DEL_CRON)).rejects.toBe(error);
      expect(reponerContrasenas).not.toHaveBeenCalled();
    },
  );

  it.each(INESPERADOS)(
    '[C-13][D-14] si reponer las contraseñas falla con %s, se relanza',
    async (_caso, error) => {
      const { puerto, reponerContrasenas } = puertoQueResponde('RESTABLECIDO');
      reponerContrasenas.mockRejectedValue(error);

      await expect(restablecerDemo(puerto, DE_UN_VISITANTE)).rejects.toBe(error);
    },
  );
});

describe('autorizado', () => {
  it.each([
    ['Bearer abc', true],
    ['Bearer ab', false],
    [null, false],
    ['abc', false],
  ])('[C-13] autorizado compara el secreto completo: %s → %s', (cabecera, esperado) => {
    expect(autorizado(cabecera, 'abc')).toBe(esperado);
  });

  it.each([
    ['con el esquema en minúsculas', 'bearer abc'],
    ['con un espacio de más delante', 'Bearer  abc'],
    ['con un espacio de más detrás', 'Bearer abc '],
    ['con el secreto seguido de más texto', 'Bearer abcd'],
    ['con otro esquema', 'Basic abc'],
    ['vacía', ''],
    ['sin el secreto', 'Bearer'],
  ])('[C-13][D-2] la cabecera %s no autoriza', (_caso, cabecera) => {
    expect(autorizado(cabecera, 'abc')).toBe(false);
  });

  it('[C-13] un secreto vacío no autoriza ni siquiera a «Bearer »', () => {
    expect(autorizado('Bearer ', '')).toBe(false);
  });

  it('[C-13] compara con timingSafeEqual también cuando las longitudes son distintas', () => {
    const comparar = vi.mocked(crypto.timingSafeEqual);
    comparar.mockClear();

    expect(autorizado('Bearer un secreto mucho más largo que el que espera', 'abc')).toBe(false);
    expect(autorizado('Bearer abc', 'abc')).toBe(true);

    expect(comparar).toHaveBeenCalledTimes(2);
  });
});
