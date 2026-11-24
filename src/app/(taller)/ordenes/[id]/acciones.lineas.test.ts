import { describe, expect, it, vi } from 'vitest';
// Antes que los módulos de la aplicación: registra los falsos que estos van a encontrar.
import { prepararAcciones } from '../../../../../tests/apoyo/ordenes-falso';
import {
  anadirLinea,
  cambiarCantidad,
  guardarManoObra,
  quitarLinea,
} from '@/adaptadores/supabase/ordenes';
import { ID_LINEA, ID_ORDEN, ID_RECAMBIO } from '../../../../../tests/apoyo/filas-de-ejemplo';
import {
  avisoDejado,
  formulario,
  SESION_MECANICO,
} from '../../../../../tests/apoyo/next-falso';
import {
  anadirRecambio,
  cambiarCantidadDeLinea,
  guardarMinutos,
  quitarRecambio,
} from './acciones';

prepararAcciones(SESION_MECANICO);

const LINEA_PERDIDA = 'Esa línea ya no está en la orden o la orden ya se entregó';

describe('anadirRecambio', () => {
  const anadir = (campos: Record<string, string> = {}) =>
    anadirRecambio(
      formulario({ ordenId: ID_ORDEN, recambioId: ID_RECAMBIO, cantidad: '2', ...campos }),
    );

  it('[C-5] añade el recambio a la orden, en el taller de la sesión y con la cantidad como número', async () => {
    await anadir();

    expect(anadirLinea).toHaveBeenCalledExactlyOnceWith({
      ordenId: ID_ORDEN,
      recambioId: ID_RECAMBIO,
      cantidad: 2,
      tallerId: 't-1',
    });
    expect(avisoDejado()).toBeNull();
  });

  it('[C-5] no manda ningún precio, aunque el formulario lo traiga: lo pone la base de datos', async () => {
    await anadir({ precioUnitarioCentimos: '1', precio: '0' });

    expect(Object.keys(vi.mocked(anadirLinea).mock.calls[0][0]).sort()).toEqual([
      'cantidad',
      'ordenId',
      'recambioId',
      'tallerId',
    ]);
  });

  it('[C-5] un recambio que ya está en la orden se explica', async () => {
    vi.mocked(anadirLinea).mockResolvedValue(false);

    await anadir();

    expect(avisoDejado()?.texto).toBe(
      'Ese recambio ya está en la orden. Cambia su cantidad en la lista',
    );
  });

  it.each([
    ['sin elegir recambio', { recambioId: '' }, 'Elige un recambio'],
    ['un recambio que no es uuid', { recambioId: 'FIL-01' }, 'Elige un recambio'],
    ['una orden que no es uuid', { ordenId: '../x' }, 'No encontramos esa orden'],
    ['cantidad cero', { cantidad: '0' }, 'La cantidad va de 1 a 999'],
    ['cantidad de mil', { cantidad: '1000' }, 'La cantidad va de 1 a 999'],
    ['cantidad negativa', { cantidad: '-3' }, 'La cantidad va de 1 a 999'],
    ['cantidad con decimales', { cantidad: '1.5' }, 'La cantidad va de 1 a 999'],
    ['cantidad en letras', { cantidad: 'dos' }, 'La cantidad va de 1 a 999'],
  ])('[D-2] %s no llega a la base de datos', async (_caso, campos, texto) => {
    await anadir(campos);

    expect(anadirLinea).not.toHaveBeenCalled();
    expect(avisoDejado()).toEqual({ tipo: 'error', texto });
  });

  it('[D-2] varios campos mal se cuentan todos en el mismo aviso', async () => {
    await anadir({ recambioId: '', cantidad: '0' });

    expect(avisoDejado()?.texto).toBe('Elige un recambio. La cantidad va de 1 a 999');
  });
});

describe('cambiarCantidadDeLinea', () => {
  const cambiar = (campos: Record<string, string> = {}) =>
    cambiarCantidadDeLinea(formulario({ lineaId: ID_LINEA, cantidad: '4', ...campos }));

  it('[C-5] guarda la cantidad nueva de la línea', async () => {
    await cambiar();

    expect(cambiarCantidad).toHaveBeenCalledExactlyOnceWith(ID_LINEA, 4);
    expect(avisoDejado()).toBeNull();
  });

  it('[C-5] si la línea ya no está o la orden se entregó, lo dice', async () => {
    vi.mocked(cambiarCantidad).mockResolvedValue(false);

    await cambiar();

    expect(avisoDejado()?.texto).toBe(LINEA_PERDIDA);
  });

  it.each([
    ['una línea que no es uuid', { lineaId: '1; drop table' }, 'No encontramos ese recambio en la orden'],
    ['cantidad cero', { cantidad: '0' }, 'La cantidad va de 1 a 999'],
    ['cantidad de mil', { cantidad: '1000' }, 'La cantidad va de 1 a 999'],
    ['cantidad vacía', { cantidad: '' }, 'La cantidad va de 1 a 999'],
  ])('[D-2] %s no llega a la base de datos', async (_caso, campos, texto) => {
    await cambiar(campos);

    expect(cambiarCantidad).not.toHaveBeenCalled();
    expect(avisoDejado()).toEqual({ tipo: 'error', texto });
  });
});

describe('quitarRecambio', () => {
  it('[C-5] quita la línea de la orden', async () => {
    await quitarRecambio(formulario({ lineaId: ID_LINEA }));

    expect(quitarLinea).toHaveBeenCalledExactlyOnceWith(ID_LINEA);
    expect(avisoDejado()).toBeNull();
  });

  it('[C-5] si la línea ya no está o la orden se entregó, lo dice', async () => {
    vi.mocked(quitarLinea).mockResolvedValue(false);

    await quitarRecambio(formulario({ lineaId: ID_LINEA }));

    expect(avisoDejado()?.texto).toBe(LINEA_PERDIDA);
  });

  it.each<Record<string, string>>([{}, { lineaId: '' }, { lineaId: 'no-soy-un-uuid' }])(
    '[D-2] con %j no llega a la base de datos',
    async (campos) => {
      await quitarRecambio(formulario(campos));

      expect(quitarLinea).not.toHaveBeenCalled();
      expect(avisoDejado()?.texto).toBe('No encontramos ese recambio en la orden');
    },
  );
});

describe('guardarMinutos', () => {
  const guardar = (campos: Record<string, string> = {}) =>
    guardarMinutos(formulario({ ordenId: ID_ORDEN, minutos: '120', ...campos }));

  it('[C-7] guarda los minutos de mano de obra de la orden', async () => {
    await guardar();

    expect(guardarManoObra).toHaveBeenCalledExactlyOnceWith(ID_ORDEN, 120);
    expect(avisoDejado()).toBeNull();
  });

  it('[C-7] cero minutos es una mano de obra válida', async () => {
    await guardar({ minutos: '0' });

    expect(guardarManoObra).toHaveBeenCalledExactlyOnceWith(ID_ORDEN, 0);
  });

  it('[C-7] si la orden ya no admite cambios, lo dice', async () => {
    vi.mocked(guardarManoObra).mockResolvedValue(false);

    await guardar();

    expect(avisoDejado()?.texto).toBe('La orden ya no admite cambios: se entregó o no existe');
  });

  it.each([
    ['minutos negativos', { minutos: '-1' }],
    ['más de 6000 minutos', { minutos: '6001' }],
    ['minutos con decimales', { minutos: '1.5' }],
    ['minutos en letras', { minutos: 'mucho' }],
    ['minutos vacíos', { minutos: '' }],
  ])('[D-2] %s no llega a la base de datos', async (_caso, campos) => {
    await guardar(campos);

    expect(guardarManoObra).not.toHaveBeenCalled();
    expect(avisoDejado()?.texto).toBe('Los minutos van de 0 a 6000');
  });

  it('[D-2] una orden que no es uuid no llega a la base de datos', async () => {
    await guardar({ ordenId: 'x' });

    expect(guardarManoObra).not.toHaveBeenCalled();
    expect(avisoDejado()?.texto).toBe('No encontramos esa orden');
  });
});
