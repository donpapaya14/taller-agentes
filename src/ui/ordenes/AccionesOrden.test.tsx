import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccionesOrden } from './AccionesOrden';

afterEach(cleanup);

const ID = '9c1e7d52-0b3a-4f68-8a2d-6e4b1c7f3a90';
const ENLACE = 'https://wa.me/34612345678?text=Hola';
const SIN_TELEFONO = 'El cliente no tiene un teléfono válido';

type Props = Parameters<typeof AccionesOrden>[0];

const props = (cambios: Partial<Props> = {}): Props => ({
  ordenId: ID,
  enlaceWhatsapp: ENLACE,
  tipoDocumento: 'presupuesto',
  puedeVerDocumento: true,
  puedeEntregar: true,
  accionEntregar: vi.fn(),
  ...cambios,
});

describe('AccionesOrden: avisar por WhatsApp', () => {
  it('[C-9] con enlace muestra el aviso que abre en otra pestaña', () => {
    render(<AccionesOrden {...props({ enlaceWhatsapp: ENLACE })} />);

    const aviso = screen.getByRole('link', { name: 'Avisar por WhatsApp' });

    expect(aviso.getAttribute('href')).toBe(ENLACE);
    expect(aviso.getAttribute('target')).toBe('_blank');
    expect(aviso.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.queryByText(SIN_TELEFONO)).toBeNull();
  });

  it('[C-9] sin teléfono válido el botón está desactivado y dice por qué', () => {
    render(<AccionesOrden {...props({ enlaceWhatsapp: null })} />);

    const aviso = screen.getByRole('button', { name: 'Avisar por WhatsApp' });

    expect(aviso.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(SIN_TELEFONO)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Avisar por WhatsApp' })).toBeNull();
  });

  it('[C-9][D-13] el motivo del botón desactivado lo lee quien usa un lector de pantalla', () => {
    render(<AccionesOrden {...props({ enlaceWhatsapp: null })} />);

    const aviso = screen.getByRole('button', { name: 'Avisar por WhatsApp' });
    const motivo = document.getElementById(aviso.getAttribute('aria-describedby') ?? '');

    expect(motivo?.textContent).toBe(SIN_TELEFONO);
  });
});

describe('AccionesOrden: descargar el documento', () => {
  it('[C-3] sin permiso no hay descarga ni entrega', () => {
    render(<AccionesOrden {...props({ puedeVerDocumento: false, puedeEntregar: false })} />);

    expect(screen.queryByText(/Descargar/)).toBeNull();
    expect(screen.queryByText(/Entregar/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Entregar' })).toBeNull();
    expect(screen.queryByText(/se emitirá la factura/)).toBeNull();
  });

  it('[C-8] el texto de descarga depende del tipo', () => {
    const { rerender } = render(<AccionesOrden {...props({ tipoDocumento: 'factura' })} />);

    expect(screen.getByRole('link', { name: 'Descargar factura' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Descargar presupuesto' })).toBeNull();

    rerender(<AccionesOrden {...props({ tipoDocumento: 'presupuesto' })} />);

    expect(screen.getByRole('link', { name: 'Descargar presupuesto' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Descargar factura' })).toBeNull();
  });

  it('[C-8] el enlace del documento lleva a la ruta de la orden, en otra pestaña', () => {
    render(<AccionesOrden {...props()} />);

    const descarga = screen.getByRole('link', { name: 'Descargar presupuesto' });

    expect(descarga.getAttribute('href')).toBe(`/ordenes/${ID}/documento`);
    expect(descarga.getAttribute('target')).toBe('_blank');
    expect(descarga.getAttribute('rel')).toBe('noopener noreferrer');
  });
});

describe('AccionesOrden: entregar', () => {
  it('[C-3] con permiso, Entregar avisa de lo que hace', () => {
    render(<AccionesOrden {...props({ puedeEntregar: true })} />);

    expect(screen.getByRole('button', { name: 'Entregar' }).getAttribute('type')).toBe('submit');
    expect(
      screen.getByText('Se descontarán los recambios del almacén y se emitirá la factura'),
    ).toBeTruthy();
  });

  it('[C-5] Entregar manda a la acción el id de la orden', async () => {
    const accionEntregar = vi.fn<(datos: FormData) => Promise<void>>();
    render(<AccionesOrden {...props({ accionEntregar })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Entregar' }));

    await waitFor(() => expect(accionEntregar).toHaveBeenCalledTimes(1));
    expect(accionEntregar.mock.calls[0][0].get('id')).toBe(ID);
  });

  // Una segunda entrega encontraría la orden ya entregada y acabaría en un aviso de error.
  it('[D-13] mientras entrega, Entregar queda desactivado para no enviar dos veces', async () => {
    const accionEntregar = vi.fn(() => new Promise<void>(() => undefined));
    render(<AccionesOrden {...props({ accionEntregar })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Entregar' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Entregar' }).hasAttribute('disabled')).toBe(true),
    );
  });

  it.each([
    ['con teléfono', ENLACE],
    ['sin teléfono', null],
  ])('[D-13] %s, todo botón y enlace de acción mide al menos --toque de alto', (_caso, enlace) => {
    render(<AccionesOrden {...props({ enlaceWhatsapp: enlace })} />);

    const acciones = [...screen.getAllByRole('button'), ...screen.getAllByRole('link')];

    expect(acciones).toHaveLength(3);
    expect(acciones.filter((accion) => ![...accion.classList].includes('min-h-toque'))).toEqual([]);
  });
});
