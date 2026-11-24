import * as crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
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

describe('restablecerDemo', () => {
  it('[C-13] con la base en espera repone igualmente las contraseñas', async () => {
    const { puerto, reponerContrasenas } = puertoQueResponde('EN_ESPERA');

    const resultado = await restablecerDemo(puerto);

    expect(resultado).toEqual({ estado: 'EN_ESPERA' });
    expect(reponerContrasenas).toHaveBeenCalledTimes(1);
  });

  it('[C-13] restablecido repone contraseñas', async () => {
    const { puerto, reponerContrasenas } = puertoQueResponde('RESTABLECIDO');

    const resultado = await restablecerDemo(puerto);

    expect(resultado).toEqual({ estado: 'RESTABLECIDO' });
    expect(reponerContrasenas).toHaveBeenCalledTimes(1);
  });
});

describe('restablecerDemo: cuando algo falla', () => {
  it('[C-13][D-14] con la base en espera, si no se pueden reponer las contraseñas devuelve ERROR con mensaje', async () => {
    const { puerto, reponerContrasenas } = puertoQueResponde('EN_ESPERA');
    reponerContrasenas.mockRejectedValue(new Error('Auth caído'));

    const resultado = await restablecerDemo(puerto);

    expect(resultado).toEqual({ estado: 'ERROR', motivo: MOTIVO });
  });

  it('[C-13][D-14] si la base de datos falla devuelve ERROR con mensaje', async () => {
    const { puerto, reponerContrasenas } = puertoQueResponde(new Error('connection refused'));

    const resultado = await restablecerDemo(puerto);

    expect(resultado).toEqual({ estado: 'ERROR', motivo: MOTIVO });
    expect(reponerContrasenas).not.toHaveBeenCalled();
  });

  it('[C-13][D-14] si no se pueden reponer las contraseñas devuelve ERROR con mensaje', async () => {
    const { puerto, reponerContrasenas } = puertoQueResponde('RESTABLECIDO');
    reponerContrasenas.mockRejectedValue(new Error('Auth caído'));

    const resultado = await restablecerDemo(puerto);

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

      const resultado = await restablecerDemo(puerto);

      expect(resultado).toEqual({ estado: 'ERROR', motivo: MOTIVO });
      expect(reponerContrasenas).not.toHaveBeenCalled();
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
