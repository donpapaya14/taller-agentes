import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ManoDeObra } from './ManoDeObra';

afterEach(cleanup);

const ID = '9c1e7d52-0b3a-4f68-8a2d-6e4b1c7f3a90';

const dibujar = (minutos = 90, accion = vi.fn<(datos: FormData) => void>()) => {
  render(<ManoDeObra ordenId={ID} minutos={minutos} accion={accion} />);
  return accion;
};

describe('ManoDeObra', () => {
  it('[C-7] pide los minutos, que empiezan en los que ya tiene la orden, de 0 a 6000', () => {
    dibujar(90);

    const campo = screen.getByLabelText<HTMLInputElement>('Mano de obra (minutos)');

    expect([campo.type, campo.min, campo.max, campo.value, campo.required]).toEqual([
      'number',
      '0',
      '6000',
      '90',
      true,
    ]);
  });

  it('[C-7] una orden sin mano de obra empieza en 0', () => {
    dibujar(0);

    expect(screen.getByLabelText<HTMLInputElement>('Mano de obra (minutos)').value).toBe('0');
  });

  it('[C-7] guardar manda el id de la orden y los minutos escritos', async () => {
    const accion = dibujar();

    fireEvent.change(screen.getByLabelText('Mano de obra (minutos)'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar mano de obra' }));

    await waitFor(() => expect(accion).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(accion.mock.calls[0][0])).toEqual({ ordenId: ID, minutos: '150' });
  });

  it('[D-13] el campo y el botón miden al menos --toque de alto', () => {
    dibujar();

    const controles = [
      screen.getByLabelText('Mano de obra (minutos)'),
      screen.getByRole('button', { name: 'Guardar mano de obra' }),
    ];

    expect(controles.filter((control) => ![...control.classList].includes('min-h-toque'))).toEqual(
      [],
    );
  });
});

describe('ManoDeObra: un solo envío', () => {
  // Un segundo toque guardaría los mismos minutos otra vez, con el total ya recalculado.
  it('[D-13] mientras guarda, «Guardar mano de obra» queda desactivado para no enviar dos veces', async () => {
    dibujar(
      90,
      vi.fn<(datos: FormData) => void>(() => new Promise<void>(() => undefined)),
    );

    const boton = screen.getByRole('button', { name: 'Guardar mano de obra' });

    fireEvent.click(boton);

    await waitFor(() => expect(boton.hasAttribute('disabled')).toBe(true));
  });
});
