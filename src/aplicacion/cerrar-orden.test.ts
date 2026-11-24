import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import type { Rol } from '@/nucleo/permisos';
import { cerrarOrden, traducirErrorCierre } from './cerrar-orden';

const ID = '9c1e7d52-0b3a-4f68-8a2d-6e4b1c7f3a90';

const SOLO_EL_JEFE = 'Solo el jefe de taller puede entregar una orden';
const NO_SE_PUDO = 'No se pudo entregar la orden. Inténtalo de nuevo';
const SIN_STOCK = 'No hay stock suficiente de FIL-01. Revisa el almacén antes de entregar';

const puertoQue = (respuesta: { numero: string } | { error: string }) => ({
  rpcCerrar: vi.fn().mockResolvedValue(respuesta),
});

// Un rol que el tipo no deja escribir pero que puede llegar de una sesión rota.
const rolFalso = (texto: string) => texto as Rol;

describe('traducirErrorCierre', () => {
  it.each([
    ['SOLO_JEFE', SOLO_EL_JEFE],
    ['ESTADO_INVALIDO', 'La orden tiene que estar en «Listo» para entregarla'],
    ['STOCK_INSUFICIENTE:FIL-01', SIN_STOCK],
    ['ORDEN_NO_ENCONTRADA', 'No encontramos esa orden'],
    ['cualquier otra cosa', NO_SE_PUDO],
  ])('[C-5][D-14] traduce «%s»', (mensaje, esperado) => {
    expect(traducirErrorCierre(mensaje)).toBe(esperado);
  });

  it.each([
    '',
    'solo_jefe',
    ' SOLO_JEFE',
    'STOCK_INSUFICIENTE',
    'STOCK_INSUFICIENTE:',
    'STOCK_INSUFICIENTE:   ',
    'stock_insuficiente:FIL-01',
    'error STOCK_INSUFICIENTE:FIL-01',
    'constructor',
    '__proto__',
    'toString',
    'fetch failed',
  ])('[C-5][D-2] «%s» no es un error conocido: mensaje general', (mensaje) => {
    expect(traducirErrorCierre(mensaje)).toBe(NO_SE_PUDO);
  });

  it('[C-5] el mensaje de stock nombra la referencia que falta', () => {
    const referencia = fc
      .array(fc.constantFrom(...'ABCXYZ0123456789-'), { minLength: 2, maxLength: 20 })
      .map((letras) => letras.join(''));

    fc.assert(
      fc.property(referencia, (clave) => {
        const mensaje = traducirErrorCierre(`STOCK_INSUFICIENTE:${clave}`);

        expect(mensaje).toContain(`stock suficiente de ${clave}.`);
      }),
    );
  });

  it('[D-2] cualquier texto da un mensaje en español y nunca lanza', () => {
    fc.assert(
      fc.property(fc.string(), (mensaje) => {
        expect(traducirErrorCierre(mensaje)).toMatch(/^[A-Z]/);
      }),
    );
  });
});

describe('cerrarOrden', () => {
  it('[C-3] el mecánico no llega a la base de datos al entregar', async () => {
    const puerto = puertoQue({ numero: 'F-2026-0002' });

    const resultado = await cerrarOrden({ id: ID, rol: 'mecanico' }, puerto);

    expect(resultado).toEqual({ ok: false, motivo: SOLO_EL_JEFE });
    expect(puerto.rpcCerrar).not.toHaveBeenCalled();
  });

  it.each(['admin', '', 'JEFE', 'constructor'])(
    '[C-3][D-2] el rol «%s» no existe y tampoco llega a la base de datos',
    async (rol) => {
      const puerto = puertoQue({ numero: 'F-2026-0002' });

      const resultado = await cerrarOrden({ id: ID, rol: rolFalso(rol) }, puerto);

      expect(resultado).toEqual({ ok: false, motivo: SOLO_EL_JEFE });
      expect(puerto.rpcCerrar).not.toHaveBeenCalled();
    },
  );

  it('[C-5] entrega correcta devuelve el número', async () => {
    const puerto = puertoQue({ numero: 'F-2026-0002' });

    const resultado = await cerrarOrden({ id: ID, rol: 'jefe' }, puerto);

    expect(resultado).toEqual({ ok: true, numeroFactura: 'F-2026-0002' });
    expect(puerto.rpcCerrar).toHaveBeenCalledExactlyOnceWith(ID);
  });

  it('[C-5][D-14] si la base de datos rechaza la entrega, el motivo va traducido', async () => {
    const puerto = puertoQue({ error: 'STOCK_INSUFICIENTE:FIL-01' });

    const resultado = await cerrarOrden({ id: ID, rol: 'jefe' }, puerto);

    expect(resultado).toEqual({ ok: false, motivo: SIN_STOCK });
  });

  it('[C-5][D-14] un error que no se conoce da el mensaje general', async () => {
    const puerto = puertoQue({ error: 'TypeError: fetch failed' });

    const resultado = await cerrarOrden({ id: ID, rol: 'jefe' }, puerto);

    expect(resultado).toEqual({ ok: false, motivo: NO_SE_PUDO });
  });
});
