import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Estado } from '@/nucleo/orden';
import { CambioDeEstado } from './CambioDeEstado';

afterEach(cleanup);

const ID = '9c1e7d52-0b3a-4f68-8a2d-6e4b1c7f3a90';

const dibujar = (estado: Estado, accion = vi.fn<(datos: FormData) => void>()) => {
  render(<CambioDeEstado ordenId={ID} estado={estado} accion={accion} />);
  return accion;
};

const botones = () => screen.queryAllByRole('button').map((boton) => boton.textContent);

describe('CambioDeEstado: qué botones ofrece', () => {
  it.each([
    ['recibido', ['Pasar a en reparación']],
    ['en_reparacion', ['Volver a recibido', 'Pasar a listo']],
    ['listo', ['Volver a en reparación']],
    ['entregado', []],
  ] as const)('[C-4] una orden en %s ofrece %j', (estado, esperados) => {
    dibujar(estado);

    expect(botones()).toEqual(esperados);
  });

  it('[C-4] nunca ofrece pasar a entregado: eso se hace con Entregar', () => {
    dibujar('listo');

    expect(screen.queryByRole('button', { name: /entregado/i })).toBeNull();
  });

  it('[D-13] todo botón mide al menos --toque de alto', () => {
    dibujar('en_reparacion');

    const pequenos = screen
      .getAllByRole('button')
      .filter((boton) => ![...boton.classList].includes('min-h-toque'));
    expect(pequenos).toEqual([]);
  });
});

describe('CambioDeEstado: un solo envío', () => {
  // Un segundo toque encontraría la orden ya movida y acabaría en un aviso de error.
  it.each(['Pasar a listo', 'Volver a recibido'])(
    '[D-13] mientras se mueve la orden, «%s» queda desactivado para no enviar dos veces',
    async (texto) => {
      dibujar(
        'en_reparacion',
        vi.fn<(datos: FormData) => void>(() => new Promise<void>(() => undefined)),
      );

      fireEvent.click(screen.getByRole('button', { name: texto }));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: texto }).hasAttribute('disabled')).toBe(true),
      );
    },
  );
});

describe('CambioDeEstado: lo que envía', () => {
  it.each([
    ['avanzar', 'Pasar a listo', 'listo'],
    ['retroceder', 'Volver a recibido', 'recibido'],
  ])('[C-4] %s manda el id, el estado de origen y el de destino', async (_paso, texto, destino) => {
    const accion = dibujar('en_reparacion');

    fireEvent.click(screen.getByRole('button', { name: texto }));

    await waitFor(() => expect(accion).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(accion.mock.calls[0][0])).toEqual({
      id: ID,
      de: 'en_reparacion',
      a: destino,
    });
  });
});
