import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrdenDetalle } from '@/adaptadores/supabase/filas';
import { leerOrden } from '@/adaptadores/supabase/ordenes';
import { listarRecambios } from '@/adaptadores/supabase/recambios';
import { leerSesion, type Sesion } from '@/adaptadores/supabase/sesion';
import {
  ID_LINEA,
  ID_ORDEN,
  ORDEN_DETALLE,
  RECAMBIO,
} from '../../../../../tests/apoyo/filas-de-ejemplo';
import {
  navegarLanzando,
  SESION_JEFE,
  SESION_MECANICO,
} from '../../../../../tests/apoyo/next-falso';
import { leerAviso } from '../../aviso';
import * as acciones from './acciones';
import FichaDeLaOrden, { metadata } from './page';

vi.mock('@/adaptadores/supabase/sesion', () => ({ leerSesion: vi.fn() }));
vi.mock('@/adaptadores/supabase/ordenes', () => ({ leerOrden: vi.fn() }));
vi.mock('@/adaptadores/supabase/recambios', () => ({ listarRecambios: vi.fn() }));
vi.mock('../../aviso', () => ({ leerAviso: vi.fn() }));
vi.mock('./acciones', () => ({
  moverEstado: vi.fn(),
  entregarOrden: vi.fn(),
  anadirRecambio: vi.fn(),
  cambiarCantidadDeLinea: vi.fn(),
  quitarRecambio: vi.fn(),
  guardarMinutos: vi.fn(),
}));

const PASTILLAS = {
  ...RECAMBIO,
  id: '5d2c8e1a-7b64-4f2b-8a4e-6c1d3e7a9b0f',
  referencia: 'PAS-07',
  nombre: 'Pastillas de freno',
};
const ENTREGADA: OrdenDetalle = {
  ...ORDEN_DETALLE,
  estado: 'entregado',
  numeroFactura: 'F-2026-0001',
  entregadaEn: '2026-11-24T09:15:00+00:00',
};
const LISTA: OrdenDetalle = { ...ORDEN_DETALLE, estado: 'listo' };

beforeEach(() => {
  vi.mocked(leerSesion).mockResolvedValue(SESION_JEFE);
  vi.mocked(leerOrden).mockResolvedValue(ORDEN_DETALLE);
  vi.mocked(listarRecambios).mockResolvedValue([RECAMBIO, PASTILLAS]);
  vi.mocked(leerAviso).mockResolvedValue(null);
  navegarLanzando();
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const pagina = (id: string = ID_ORDEN) => FichaDeLaOrden({ params: Promise.resolve({ id }) });

async function dibujar(orden: OrdenDetalle = ORDEN_DETALLE, sesion: Sesion = SESION_JEFE) {
  vi.mocked(leerOrden).mockResolvedValue(orden);
  vi.mocked(leerSesion).mockResolvedValue(sesion);
  return render(await pagina());
}

const boton = (nombre: string | RegExp) => screen.queryByRole('button', { name: nombre });

describe('/ordenes/[id]: quién entra y qué orden', () => {
  it('[C-1] sin sesión redirige a /login y no lee nada', async () => {
    vi.mocked(leerSesion).mockResolvedValue(null);

    await expect(pagina()).rejects.toThrow('REDIRIGE:/login');

    expect(leerOrden).not.toHaveBeenCalled();
  });

  it('[C-1] un fallo al leer la sesión no se confunde con «sin sesión»', async () => {
    vi.mocked(leerSesion).mockRejectedValue(new Error('No se pudo cargar tu taller.'));

    await expect(pagina()).rejects.toThrow('No se pudo cargar tu taller.');
  });

  it('[C-2] una orden que no existe o es de otro taller da «no encontrado» sin pedir más', async () => {
    vi.mocked(leerOrden).mockResolvedValue(null);

    await expect(pagina('9c1e7d52-0b3a-4f68-8a2d-6e4b1c7f3a91')).rejects.toThrow('NO_ENCONTRADO');

    expect(leerOrden).toHaveBeenCalledExactlyOnceWith('9c1e7d52-0b3a-4f68-8a2d-6e4b1c7f3a91');
    expect(listarRecambios).not.toHaveBeenCalled();
  });

  it.each([
    ['la orden', 'No se pudo cargar la orden.', () => vi.mocked(leerOrden)],
    ['los recambios', 'No se pudieron cargar los recambios.', () => vi.mocked(listarRecambios)],
  ])('[C-15] si falla la lectura de %s el fallo sube a la pantalla de error', async (_cual, mensaje, lectura) => {
    lectura().mockRejectedValue(new Error(mensaje));

    await expect(pagina()).rejects.toThrow(mensaje);
  });

  it('la pestaña del navegador lleva el título de la pantalla', () => {
    expect(metadata.title).toBe('Orden · FOSO');
  });
});

describe('/ordenes/[id]: la orden', () => {
  it('[C-10] abre con la placa grande, el estado, el cliente y lo que hay que hacer', async () => {
    await dibujar();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('1234BCD');
    expect(screen.getByText('En reparación')).toBeTruthy();
    expect(screen.getByText('Marta Ruiz')).toBeTruthy();
    expect(screen.getByText('Cambio de aceite')).toBeTruthy();
  });

  it('[C-4] una orden abierta se puede mover un paso, atrás o adelante, y nunca a entregado', async () => {
    await dibujar();

    expect(boton('Volver a recibido')).not.toBeNull();
    expect(boton('Pasar a listo')).not.toBeNull();
    expect(boton(/entregado/i)).toBeNull();
  });

  it('[C-15][D-11] sin recambios lo dice', async () => {
    await dibujar({ ...ORDEN_DETALLE, lineas: [] });

    expect(screen.getByText('Sin recambios todavía')).toBeTruthy();
  });

  it('[C-5] una orden abierta deja cambiar y quitar sus recambios, y añadir otros', async () => {
    await dibujar();

    expect(boton('Quitar')).not.toBeNull();
    expect(screen.getByLabelText('Cantidad de Filtro de aceite')).toBeTruthy();
    expect(boton('Añadir')).not.toBeNull();
  });

  it('[C-5] al añadir no se ofrece un recambio que ya está en la orden', async () => {
    await dibujar();

    const opciones = within(screen.getByLabelText('Recambio')).getAllByRole('option');

    expect(opciones.map((opcion) => opcion.textContent)).toEqual([
      'Elige un recambio',
      'PAS-07 · Pastillas de freno',
    ]);
  });

  it('[C-7] la mano de obra empieza en los minutos que ya tiene la orden', async () => {
    await dibujar();

    expect(screen.getByLabelText<HTMLInputElement>('Mano de obra (minutos)').value).toBe('90');
  });
});

describe('/ordenes/[id]: una orden entregada', () => {
  it('[C-4] ya no cambia: ni estados, ni recambios que tocar, ni mano de obra, y no se leen recambios', async () => {
    await dibujar(ENTREGADA);

    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.getByText('90 min')).toBeTruthy();
    expect(listarRecambios).not.toHaveBeenCalled();
  });

  it('[C-8] dice el número de su factura y ofrece descargarla', async () => {
    await dibujar(ENTREGADA);

    expect(screen.getByText('Factura F-2026-0001')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Descargar factura' }).getAttribute('href')).toBe(
      `/ordenes/${ID_ORDEN}/documento`,
    );
  });
});

describe('/ordenes/[id]: importes y permisos', () => {
  it('[C-7] el jefe ve la base, el IVA y el total, calculados en céntimos', async () => {
    await dibujar();

    expect(screen.getByText('92,50 €')).toBeTruthy();
    expect(screen.getByText('19,43 €')).toBeTruthy();
    expect(screen.getByText('111,93 €')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Descargar presupuesto' })).toBeTruthy();
  });

  it('[C-3] el mecánico no ve ningún importe ni puede descargar el documento', async () => {
    await dibujar(LISTA, SESION_MECANICO);

    expect(document.body.textContent).not.toContain('€');
    expect(screen.queryByText(/Descargar/)).toBeNull();
    expect(screen.queryByText('Base imponible')).toBeNull();
  });

  it('[C-3] el mecánico tampoco entrega, pero sí mueve la orden y le añade recambios', async () => {
    await dibujar(LISTA, SESION_MECANICO);

    expect(boton('Entregar')).toBeNull();
    expect(boton('Volver a en reparación')).not.toBeNull();
    expect(boton('Añadir')).not.toBeNull();
  });

  it('[C-5] el jefe entrega una orden lista, con el aviso de lo que pasa al entregarla', async () => {
    await dibujar(LISTA);

    expect(boton('Entregar')).not.toBeNull();
    expect(screen.getByText(/Se descontarán los recambios del almacén/)).toBeTruthy();
  });

  it('[C-5] el jefe no entrega una orden que aún no está lista', async () => {
    await dibujar(ORDEN_DETALLE);

    expect(boton('Entregar')).toBeNull();
  });
});

describe('/ordenes/[id]: avisar al cliente', () => {
  it('[C-9] con un teléfono válido, el aviso abre WhatsApp con el taller, la matrícula y el estado', async () => {
    await dibujar();

    const enlace = screen.getByRole('link', { name: 'Avisar por WhatsApp' });
    const direccion = new URL(enlace.getAttribute('href') ?? '');

    expect(direccion.origin + direccion.pathname).toBe('https://wa.me/34612345678');
    expect(direccion.searchParams.get('text')).toBe(
      'Hola, le escribimos de Taller Demo. Ya estamos trabajando en su vehículo 1234BCD.',
    );
  });

  it('[C-9] sin un teléfono válido el botón está desactivado y dice por qué', async () => {
    await dibujar({ ...ORDEN_DETALLE, clienteTelefono: '' });

    expect(boton('Avisar por WhatsApp')?.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('El cliente no tiene un teléfono válido')).toBeTruthy();
  });
});

describe('/ordenes/[id]: el aviso de la última acción', () => {
  it.each([
    ['error', 'alert', 'Otra persona ya movió esta orden. Recarga el tablero'],
    ['ok', 'status', 'Orden entregada. Factura F-2026-0001'],
  ] as const)('[D-14] un aviso de tipo %s se muestra como %s', async (tipo, rol, texto) => {
    vi.mocked(leerAviso).mockResolvedValue({ tipo, texto });

    await dibujar();

    expect(screen.getByRole(rol).textContent).toBe(texto);
  });

  it('[D-14] sin aviso pendiente no hay alerta', async () => {
    await dibujar();

    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('/ordenes/[id]: cada botón lanza su acción', () => {
  const lanzado = (accion: unknown) =>
    Object.fromEntries(vi.mocked(accion as (datos: FormData) => void).mock.calls[0][0]);

  it.each([
    ['Pasar a listo', 'moverEstado', ORDEN_DETALLE, { id: ID_ORDEN, de: 'en_reparacion', a: 'listo' }],
    ['Entregar', 'entregarOrden', LISTA, { id: ID_ORDEN }],
    ['Quitar', 'quitarRecambio', ORDEN_DETALLE, { lineaId: ID_LINEA }],
    ['Guardar', 'cambiarCantidadDeLinea', ORDEN_DETALLE, { lineaId: ID_LINEA, cantidad: '2' }],
    ['Guardar mano de obra', 'guardarMinutos', ORDEN_DETALLE, { ordenId: ID_ORDEN, minutos: '90' }],
  ] as const)('[C-5] «%s» llama a %s con lo que pide la acción', async (texto, nombre, orden, campos) => {
    await dibujar(orden);

    fireEvent.click(screen.getByRole('button', { name: texto }));

    await waitFor(() => expect(acciones[nombre]).toHaveBeenCalledTimes(1));
    expect(lanzado(acciones[nombre])).toEqual(campos);
  });

  it('[C-5] «Añadir» llama a anadirRecambio con el recambio elegido y la cantidad', async () => {
    await dibujar();

    fireEvent.change(screen.getByLabelText('Recambio'), { target: { value: PASTILLAS.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));

    await waitFor(() => expect(acciones.anadirRecambio).toHaveBeenCalledTimes(1));
    expect(lanzado(acciones.anadirRecambio)).toEqual({
      ordenId: ID_ORDEN,
      recambioId: PASTILLAS.id,
      cantidad: '1',
    });
  });
});
