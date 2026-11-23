import { afterEach, describe, expect, it, vi } from 'vitest';
import { conTiempoLimite, esFalloDeRedOTiempo, LIMITE_MS } from './tiempo-limite';

const URL_DE_PRUEBA = 'https://proyecto.example/auth/v1/user';

// Como el fetch de verdad: no contesta nunca, salvo que lo aborte su señal.
const fetchQueNuncaResuelve: typeof fetch = (_entrada, opciones) =>
  new Promise((_resolver, rechazar) => {
    opciones?.signal?.addEventListener('abort', () => rechazar(opciones.signal?.reason));
  });

const fetchQueResponde = () => vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'));

afterEach(() => {
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
