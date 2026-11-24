import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchQueNuncaResuelve } from '../../../tests/apoyo/fetch-falso';
import {
  conPlazoTotal,
  conTiempoLimite,
  esFalloDeRedOTiempo,
  LIMITE_MS,
  PLAZO_TOTAL_MS,
  PlazoVencido,
} from './tiempo-limite';

const URL_DE_PRUEBA = 'https://proyecto.example/auth/v1/user';

const fetchQueResponde = () => vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'));

// Una operación que no acaba nunca y no mira ninguna señal, como la espera entre reintentos de auth-js.
const sinTerminar = () => new Promise<never>(() => undefined);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('conTiempoLimite', () => {
  it('[D-14] una petición que no responde se corta al llegar al límite', async () => {
    const inicio = performance.now();

    const peticion = conTiempoLimite(fetchQueNuncaResuelve, 50)(URL_DE_PRUEBA);

    await expect(peticion).rejects.toMatchObject({
      name: expect.stringMatching(/^(?:TimeoutError|AbortError)$/),
    });
    expect(performance.now() - inicio).toBeLessThan(500);
  });

  it('[D-14] una petición que responde a tiempo pasa intacta', async () => {
    const respuesta = new Response('ok', { status: 200 });
    const buscar = vi.fn<typeof fetch>().mockResolvedValue(respuesta);

    const recibida = await conTiempoLimite(buscar, 50)(URL_DE_PRUEBA);

    expect(recibida).toBe(respuesta);
  });

  it('reenvía la dirección y las opciones y solo añade la señal', async () => {
    const buscar = fetchQueResponde();
    const opciones = { method: 'POST', headers: { apikey: 'clave' }, body: '{}' };

    await conTiempoLimite(buscar)(URL_DE_PRUEBA, opciones);

    expect(buscar).toHaveBeenCalledWith(URL_DE_PRUEBA, {
      ...opciones,
      signal: expect.any(AbortSignal),
    });
  });

  it('sin opciones también añade la señal', async () => {
    const buscar = fetchQueResponde();

    await conTiempoLimite(buscar)(URL_DE_PRUEBA);

    expect(buscar).toHaveBeenCalledWith(URL_DE_PRUEBA, { signal: expect.any(AbortSignal) });
  });

  it('respeta la señal que ya traía la petición', async () => {
    const cancelar = new AbortController();
    const peticion = conTiempoLimite(fetchQueNuncaResuelve, 5000)(URL_DE_PRUEBA, {
      signal: cancelar.signal,
    });

    cancelar.abort(new Error('cancelada por quien llama'));

    await expect(peticion).rejects.toThrow('cancelada por quien llama');
  });

  it('sin indicar el tiempo usa el límite de 4 s', async () => {
    const espiar = vi.spyOn(AbortSignal, 'timeout');

    await conTiempoLimite(fetchQueResponde())(URL_DE_PRUEBA);

    expect(LIMITE_MS).toBe(4000);
    expect(espiar).toHaveBeenCalledWith(4000);
  });
});

describe('conTiempoLimite con el plazo de la operación', () => {
  it('[D-14] se corta al vencer el plazo de la operación aunque el límite de la petición sea mayor', async () => {
    const plazo = new AbortController();
    const peticion = conTiempoLimite(fetchQueNuncaResuelve, 5000, plazo.signal)(URL_DE_PRUEBA);

    plazo.abort(new Error('plazo vencido'));

    await expect(peticion).rejects.toThrow('plazo vencido');
  });

  it('[D-14] con el plazo ya vencido la petición no llega a esperar', async () => {
    const plazo = AbortSignal.abort(new Error('plazo vencido'));

    const peticion = conTiempoLimite(fetchQueNuncaResuelve, 5000, plazo)(URL_DE_PRUEBA);

    await expect(peticion).rejects.toThrow('plazo vencido');
  });
});

describe('conPlazoTotal', () => {
  it('devuelve lo que devuelve la operación si acaba a tiempo', async () => {
    await expect(conPlazoTotal(async () => 'listo', 50)).resolves.toBe('listo');
  });

  it('relanza el error de la operación tal cual', async () => {
    const fallo = new Error('boom');

    await expect(conPlazoTotal(() => Promise.reject(fallo), 50)).rejects.toBe(fallo);
  });

  it('[D-14] al vencer el plazo lanza PlazoVencido aunque la operación no mire ninguna señal', async () => {
    const inicio = performance.now();

    await expect(conPlazoTotal(sinTerminar, 50)).rejects.toBeInstanceOf(PlazoVencido);

    expect(performance.now() - inicio).toBeLessThan(500);
  });

  it('[D-14] al vencer el plazo aborta la señal que dio a la operación', async () => {
    let plazoDeLaOperacion: AbortSignal | undefined;
    const operacion = (plazo: AbortSignal) => {
      plazoDeLaOperacion = plazo;
      return sinTerminar();
    };

    await expect(conPlazoTotal(operacion, 50)).rejects.toBeInstanceOf(PlazoVencido);

    expect(plazoDeLaOperacion?.aborted).toBe(true);
  });
});

describe('conPlazoTotal con el reloj parado', () => {
  it('si la operación acaba antes no deja el plazo corriendo ni aborta nada', async () => {
    vi.useFakeTimers();
    let plazoDeLaOperacion: AbortSignal | undefined;

    await conPlazoTotal(async (plazo) => {
      plazoDeLaOperacion = plazo;
    }, 50);
    await vi.advanceTimersByTimeAsync(100);

    expect(vi.getTimerCount()).toBe(0);
    expect(plazoDeLaOperacion?.aborted).toBe(false);
  });

  it('sin indicar el plazo usa PLAZO_TOTAL_MS, que deja la operación entera por debajo de 5 s', async () => {
    vi.useFakeTimers();
    let vencido = false;
    const espera = conPlazoTotal(sinTerminar).catch(() => {
      vencido = true;
    });

    await vi.advanceTimersByTimeAsync(PLAZO_TOTAL_MS - 1);
    const antesDelPlazo = vencido;
    await vi.advanceTimersByTimeAsync(1);
    await espera;

    expect(antesDelPlazo).toBe(false);
    expect(vencido).toBe(true);
    expect(PLAZO_TOTAL_MS).toBeLessThan(5000);
  });
});

describe('PlazoVencido', () => {
  it('es un error con un nombre propio y un mensaje que dice cuánto se esperó', () => {
    const error = new PlazoVencido(4500);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PlazoVencido');
    expect(error.message).toContain('4500');
  });
});

describe('esFalloDeRedOTiempo', () => {
  it.each([
    [
      'un tiempo agotado',
      new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
    ],
    ['una petición abortada', new DOMException('This operation was aborted', 'AbortError')],
    ['un fallo de red de fetch', new TypeError('fetch failed')],
  ])('reconoce %s', (_, error) => {
    expect(esFalloDeRedOTiempo(error)).toBe(true);
  });

  it.each([
    ['un error cualquiera', new Error('boom')],
    ['un TypeError que no es de red', new TypeError('x is not a function')],
    ['un Error que solo dice fetch failed', new Error('fetch failed')],
    ['un texto', 'fetch failed'],
    ['un objeto que solo lleva el nombre', { name: 'TimeoutError', message: 'fetch failed' }],
    ['null', null],
    ['undefined', undefined],
  ])('[D-2] no confunde %s con un fallo de red o de tiempo', (_, error) => {
    expect(esFalloDeRedOTiempo(error)).toBe(false);
  });
});
