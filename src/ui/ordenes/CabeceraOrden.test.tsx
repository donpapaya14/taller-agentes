import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CabeceraOrden } from './CabeceraOrden';

afterEach(cleanup);

type Props = Parameters<typeof CabeceraOrden>[0];

const props = (cambios: Partial<Props> = {}): Props => ({
  matricula: '1234BCD',
  estado: 'en_reparacion',
  numeroFactura: null,
  vehiculo: 'Seat Ibiza',
  cliente: 'Marta Ruiz',
  clienteTelefono: '612 345 678',
  descripcion: 'Cambio de aceite',
  ...cambios,
});

describe('CabeceraOrden: la orden de un vistazo', () => {
  it('[C-10] la matrícula, dibujada como placa grande, es el título de la ficha', () => {
    render(<CabeceraOrden {...props()} />);

    const titulo = screen.getByRole('heading', { level: 1 });

    expect(titulo.textContent).toContain('1234BCD');
    expect(titulo.querySelector('.matricula')).not.toBeNull();
    expect([...titulo.classList]).toContain('@container');
  });

  it('[C-10] dice el estado de la orden con su etiqueta', () => {
    render(<CabeceraOrden {...props({ estado: 'en_reparacion' })} />);

    expect(screen.getByText('En reparación')).toBeTruthy();
  });

  it('[C-8] una orden entregada dice el número de su factura', () => {
    render(<CabeceraOrden {...props({ estado: 'entregado', numeroFactura: 'F-2026-0001' })} />);

    expect(screen.getByText('Entregado')).toBeTruthy();
    expect(screen.getByText('Factura F-2026-0001')).toBeTruthy();
  });

  it('[C-8] una orden sin factura no habla de ninguna', () => {
    render(<CabeceraOrden {...props()} />);

    expect(screen.queryByText(/Factura/)).toBeNull();
  });
});

describe('CabeceraOrden: los datos', () => {
  it('[C-10] muestra el vehículo, el cliente con su teléfono y lo que hay que hacer', () => {
    render(<CabeceraOrden {...props()} />);

    const datos = Object.fromEntries(
      screen
        .getAllByRole('term')
        .map((termino) => [termino.textContent, termino.nextElementSibling?.textContent]),
    );

    expect(datos).toEqual({
      Vehículo: 'Seat Ibiza',
      Cliente: 'Marta Ruiz',
      Teléfono: '612 345 678',
      'Qué hay que hacer': 'Cambio de aceite',
    });
  });

  it('[C-9] un cliente sin teléfono lo dice en vez de dejar el hueco', () => {
    render(<CabeceraOrden {...props({ clienteTelefono: '' })} />);

    expect(screen.getByText('Sin teléfono')).toBeTruthy();
  });

  it('[C-10] un vehículo sin marca ni modelo lo dice en vez de dejar el hueco', () => {
    render(<CabeceraOrden {...props({ vehiculo: '' })} />);

    expect(screen.getByText('Sin marca ni modelo')).toBeTruthy();
  });

  it('[D-13] los textos largos parten sus palabras dentro de la pantalla', () => {
    const largo = 'x'.repeat(120);
    render(
      <CabeceraOrden {...props({ vehiculo: largo, cliente: largo, descripcion: largo })} />,
    );

    const sinAjuste = screen
      .getAllByText(largo)
      .filter((texto) => !texto.closest('.wrap-anywhere'));

    expect(sinAjuste).toEqual([]);
  });
});
