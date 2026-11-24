import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generarPdf } from '@/adaptadores/pdf/generar';
import type { OrdenDetalle } from '@/adaptadores/supabase/filas';
import { leerOrden } from '@/adaptadores/supabase/ordenes';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import { bien, mal, preparar } from '../../../../../../tests/apoyo/cliente-falso';
import { ID_ORDEN, ORDEN_DETALLE } from '../../../../../../tests/apoyo/filas-de-ejemplo';
import {
  redirect,
  navegarLanzando,
  SESION_JEFE,
  SESION_MECANICO,
} from '../../../../../../tests/apoyo/next-falso';
import { GET } from './route';

vi.mock('@/adaptadores/supabase/sesion', () => ({ leerSesion: vi.fn() }));
vi.mock('@/adaptadores/supabase/ordenes', () => ({ leerOrden: vi.fn() }));
vi.mock('@/adaptadores/supabase/cliente-servidor', () =>
  import('../../../../../../tests/apoyo/cliente-falso').then((m) => m.clienteServidorFalso),
);
// El generador es el de verdad, pero espiado para ver qué documento recibe y poder hacerlo fallar.
vi.mock('@/adaptadores/pdf/generar', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/adaptadores/pdf/generar')>();
  return { generarPdf: vi.fn(original.generarPdf) };
});

const ORDEN: OrdenDetalle = { ...ORDEN_DETALLE, estado: 'listo' };
const ENTREGADA: OrdenDetalle = {
  ...ORDEN,
  estado: 'entregado',
  numeroFactura: 'F-2026-0001',
  entregadaEn: '2026-11-24T09:15:00+00:00',
};

const TALLER = {
  nombre: 'Taller Demo',
  nif: 'B12345674',
  direccion: 'Calle Mayor 1, Murcia',
  telefono: '968123456',
};

const pedir = (id: string = ID_ORDEN) =>
  GET(new Request(`https://foso.example/ordenes/${id}/documento`), {
    params: Promise.resolve({ id }),
  });

const documentoGenerado = () => vi.mocked(generarPdf).mock.calls[0][0];

beforeEach(() => {
  vi.mocked(leerSesion).mockResolvedValue(SESION_JEFE);
  vi.mocked(leerOrden).mockResolvedValue(ORDEN);
  preparar(bien(TALLER));
  navegarLanzando();
});

afterEach(() => vi.resetAllMocks());

describe('GET /ordenes/[id]/documento: quién puede', () => {
  it('[C-1] sin sesión redirige a /login antes de leer nada', async () => {
    vi.mocked(leerSesion).mockResolvedValue(null);

    await expect(pedir()).rejects.toThrow('REDIRIGE:/login');

    expect(leerOrden).not.toHaveBeenCalled();
    expect(generarPdf).not.toHaveBeenCalled();
  });

  it('[D-14] un fallo al leer la sesión se cuenta con un 500 que se entiende, sin redirigir', async () => {
    vi.mocked(leerSesion).mockRejectedValue(new Error('Falta la variable de entorno SUPABASE_URL'));

    const respuesta = await pedir();

    expect(respuesta.status).toBe(500);
    expect(await respuesta.text()).toBe('No se pudo comprobar tu sesión. Inténtalo de nuevo.');
    expect(redirect).not.toHaveBeenCalled();
    expect(leerOrden).not.toHaveBeenCalled();
  });

  it('[C-3] el mecánico recibe un 403 con el motivo y no se lee ninguna orden', async () => {
    vi.mocked(leerSesion).mockResolvedValue(SESION_MECANICO);

    const respuesta = await pedir();

    expect(respuesta.status).toBe(403);
    expect(await respuesta.text()).toBe('Solo el jefe de taller puede descargar este documento');
    expect(leerOrden).not.toHaveBeenCalled();
    expect(generarPdf).not.toHaveBeenCalled();
  });

  it('[C-2] una orden que no existe o es de otro taller recibe un 404', async () => {
    vi.mocked(leerOrden).mockResolvedValue(null);

    const respuesta = await pedir('9c1e7d52-0b3a-4f68-8a2d-6e4b1c7f3a91');

    expect(respuesta.status).toBe(404);
    expect(await respuesta.text()).toBe('No encontramos esa orden');
    expect(leerOrden).toHaveBeenCalledExactlyOnceWith('9c1e7d52-0b3a-4f68-8a2d-6e4b1c7f3a91');
    expect(generarPdf).not.toHaveBeenCalled();
  });
});

describe('GET /ordenes/[id]/documento: el PDF', () => {
  it('[C-8] el jefe recibe un PDF que se abre en el navegador, con el nombre del presupuesto', async () => {
    const respuesta = await pedir();
    const bytes = new Uint8Array(await respuesta.arrayBuffer());

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('Content-Type')).toBe('application/pdf');
    expect(respuesta.headers.get('Content-Disposition')).toBe(
      'inline; filename="presupuesto-1234BCD.pdf"',
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('[C-8] una orden entregada es una factura, y el archivo lleva su número', async () => {
    vi.mocked(leerOrden).mockResolvedValue(ENTREGADA);

    const respuesta = await pedir();

    expect(respuesta.headers.get('Content-Disposition')).toBe(
      'inline; filename="factura-F-2026-0001.pdf"',
    );
    expect(documentoGenerado()).toMatchObject({ tipo: 'factura', numero: 'F-2026-0001' });
  });

  it('[C-8] una orden sin entregar es un presupuesto, sin número', async () => {
    await pedir();

    expect(documentoGenerado()).toMatchObject({ tipo: 'presupuesto', numero: null });
  });

  it('[D-14] el archivo no se queda en la caché del navegador ni de intermediarios', async () => {
    const respuesta = await pedir();

    expect(respuesta.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('[D-8] entrega justo los bytes del PDF, aunque sean una vista de un búfer más grande', async () => {
    const bufer = new Uint8Array([0, 0, 37, 80, 68, 70, 0, 0]);
    vi.mocked(generarPdf).mockResolvedValueOnce(bufer.subarray(2, 6));

    const respuesta = await pedir();

    expect([...new Uint8Array(await respuesta.arrayBuffer())]).toEqual([37, 80, 68, 70]);
  });
});

describe('GET /ordenes/[id]/documento: lo que lleva el documento', () => {
  it('[C-8] el documento lleva la matrícula, el cliente, las líneas y la mano de obra', async () => {
    await pedir();

    const documento = documentoGenerado();
    expect(documento.vehiculo).toEqual({ matricula: '1234BCD', marca: 'Seat', modelo: 'Ibiza' });
    expect(documento.cliente).toEqual({ nombre: 'Marta Ruiz', telefono: '34612345678' });
    expect(documento.descripcion).toBe('Cambio de aceite');
    expect(documento.filas.map((fila) => fila.concepto)).toEqual([
      'Filtro de aceite (FIL-01)',
      'Mano de obra',
    ]);
  });

  it('[C-7] los importes del documento salen del núcleo, en céntimos enteros', async () => {
    await pedir();

    expect(documentoGenerado().totales).toEqual({
      base: '92,50 €',
      iva: '19,43 €',
      total: '111,93 €',
    });
  });
});

describe('GET /ordenes/[id]/documento: el nombre del archivo', () => {
  it('[D-2] una matrícula con comillas o saltos de línea no rompe la cabecera', async () => {
    vi.mocked(leerOrden).mockResolvedValue({ ...ORDEN, matricula: '1234 B"CD\r\nX-Evil: 1' });

    const respuesta = await pedir();

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('Content-Disposition')).toBe(
      'inline; filename="presupuesto-1234-B-CD-X-Evil-1.pdf"',
    );
    expect(respuesta.headers.get('X-Evil')).toBeNull();
  });

  it('[D-2] las letras con tilde o la eñe tampoco pasan tal cual', async () => {
    vi.mocked(leerOrden).mockResolvedValue({ ...ORDEN, matricula: '1234ÑÁ' });

    const respuesta = await pedir();

    expect(respuesta.headers.get('Content-Disposition')).toBe(
      'inline; filename="presupuesto-1234-.pdf"',
    );
  });
});

describe('GET /ordenes/[id]/documento: la fecha y el taller', () => {
  it.each([
    ['un presupuesto, el día en que se creó la orden', ORDEN, '23/11/2026'],
    ['un presupuesto de una orden creada pasada la medianoche de Madrid', { ...ORDEN, creadaEn: '2026-11-23T23:30:00+00:00' }, '24/11/2026'],
    ['una factura, el día de la entrega', ENTREGADA, '24/11/2026'],
  ])('[C-8] %s', async (_caso, orden, fecha) => {
    vi.mocked(leerOrden).mockResolvedValue(orden);

    await pedir();

    expect(documentoGenerado().fecha).toBe(fecha);
  });

  it('[C-8] lee los datos del taller de la sesión y los pone en la cabecera', async () => {
    const consultas = preparar(bien(TALLER));

    await pedir();

    expect(consultas[0]).toEqual([
      ['from', 'talleres'],
      ['select', 'nombre, nif, direccion, telefono'],
      ['eq', 'id', SESION_JEFE.tallerId],
      ['maybeSingle'],
    ]);
    expect(documentoGenerado().cabecera).toEqual(TALLER);
  });

  it('[C-8] un taller sin NIF, dirección ni teléfono sale con la cabecera en blanco, no con «null»', async () => {
    preparar(bien({ nombre: 'Taller Demo', nif: null, direccion: null, telefono: null }));

    await pedir();

    expect(documentoGenerado().cabecera).toEqual({
      nombre: 'Taller Demo',
      nif: '',
      direccion: '',
      telefono: '',
    });
  });
});

describe('GET /ordenes/[id]/documento: cuando algo falla', () => {
  const NO_SE_PUDO = 'No se pudo generar el documento. Inténtalo de nuevo.';

  it.each([
    ['la lectura de la orden', () => vi.mocked(leerOrden).mockRejectedValue(new Error('boom'))],
    ['la lectura del taller', () => preparar(mal('boom'))],
    ['una fila de taller que no es la esperada', () => preparar(bien({ nombre: 5 }))],
    ['un taller que no existe', () => preparar(bien(null))],
    ['el generador del PDF', () => vi.mocked(generarPdf).mockRejectedValue(new Error('boom'))],
  ])('[D-14] si falla %s responde 500 con un texto que se entiende', async (_caso, romper) => {
    romper();

    const respuesta = await pedir();

    expect(respuesta.status).toBe(500);
    expect(await respuesta.text()).toBe(NO_SE_PUDO);
  });
});
