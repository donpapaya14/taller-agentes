import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnadirRecambio } from './AnadirRecambio';

afterEach(cleanup);

const ID = '9c1e7d52-0b3a-4f68-8a2d-6e4b1c7f3a90';
const FILTRO = '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7b64';

const RECAMBIOS = [
  { id: FILTRO, referencia: 'FIL-01', nombre: 'Filtro de aceite' },
  { id: '5d2c8e1a-7b64-4f2b-8a4e-6c1d3e7a9b0f', referencia: 'PAS-07', nombre: 'Pastillas de freno' },
];

const dibujar = (recambios = RECAMBIOS, accion = vi.fn<(datos: FormData) => void>()) => {
  render(<AnadirRecambio ordenId={ID} recambios={recambios} accion={accion} />);
  return accion;
};

describe('AnadirRecambio: lo que pide', () => {
  it('[C-5] ofrece cada recambio con su referencia y su nombre, y nada de precios', () => {
    dibujar();

    const opciones = within(screen.getByLabelText('Recambio')).getAllByRole('option');

    expect(opciones.map((opcion) => opcion.textContent)).toEqual([
      'Elige un recambio',
      'FIL-01 · Filtro de aceite',
      'PAS-07 · Pastillas de freno',
    ]);
    expect(document.body.textContent).not.toContain('€');
  });

  it('[C-5] la cantidad empieza en 1 y va de 1 a 999', () => {
    dibujar();

    const cantidad = screen.getByLabelText<HTMLInputElement>('Cantidad');

    expect([cantidad.type, cantidad.min, cantidad.max, cantidad.value, cantidad.required]).toEqual([
      'number',
      '1',
      '999',
      '1',
      true,
    ]);
  });

  it('[C-15][D-11] sin recambios por añadir lo dice y no hay formulario', () => {
    dibujar([]);

    expect(screen.getByText('No hay más recambios en el almacén para añadir')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Añadir' })).toBeNull();
    expect(screen.queryByLabelText('Recambio')).toBeNull();
  });

  it('[D-13] el selector, la cantidad y el botón miden al menos --toque de alto', () => {
    dibujar();

    const controles = [
      screen.getByLabelText('Recambio'),
      screen.getByLabelText('Cantidad'),
      screen.getByRole('button', { name: 'Añadir' }),
    ];

    expect(controles.filter((control) => ![...control.classList].includes('min-h-toque'))).toEqual(
      [],
    );
  });
});

describe('AnadirRecambio: lo que envía', () => {
  it('[C-5] manda el id de la orden, el recambio elegido y la cantidad', async () => {
    const accion = dibujar();

    fireEvent.change(screen.getByLabelText('Recambio'), { target: { value: FILTRO } });
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));

    await waitFor(() => expect(accion).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(accion.mock.calls[0][0])).toEqual({
      ordenId: ID,
      recambioId: FILTRO,
      cantidad: '3',
    });
  });
});

describe('AnadirRecambio: un solo envío', () => {
  // Un segundo toque añadiría el mismo recambio dos veces.
  it('[D-13] mientras se envía, «Añadir» queda desactivado para no enviar dos veces', async () => {
    dibujar(RECAMBIOS, vi.fn<(datos: FormData) => void>(() => new Promise<void>(() => undefined)));
    fireEvent.change(screen.getByLabelText('Recambio'), { target: { value: FILTRO } });
    const boton = screen.getByRole('button', { name: 'Añadir' });

    fireEvent.click(boton);

    await waitFor(() => expect(boton.hasAttribute('disabled')).toBe(true));
  });
});
