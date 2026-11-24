import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LineasOrden, type LineaVista } from './LineasOrden';

afterEach(cleanup);

const FILTRO: LineaVista = {
  id: 'linea-1',
  referencia: 'FIL-01',
  nombre: 'Filtro de aceite',
  cantidad: 2,
  precioUnitarioCentimos: 1250,
};

const PASTILLAS: LineaVista = {
  id: 'linea-2',
  referencia: 'PAS-07',
  nombre: 'Pastillas de freno delanteras',
  cantidad: 1,
  precioUnitarioCentimos: 4890,
};

const filas = () => screen.getAllByRole('listitem');

describe('LineasOrden: lo que cuenta', () => {
  it('[C-15][D-11] una orden sin líneas muestra su estado vacío', () => {
    render(<LineasOrden lineas={[]} verImportes editable={false} />);

    expect(screen.getByText('Sin recambios todavía')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('[C-15][D-11] vacía y editable sigue diciendo que no hay recambios, sin controles', () => {
    render(<LineasOrden lineas={[]} verImportes editable accionCantidad={vi.fn()} accionQuitar={vi.fn()} />);

    expect(screen.getByText('Sin recambios todavía')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('muestra la referencia, el nombre y la cantidad de cada línea, por orden', () => {
    render(<LineasOrden lineas={[FILTRO, PASTILLAS]} verImportes={false} editable={false} />);

    const textos = filas().map((fila) => fila.textContent);

    expect(textos).toEqual([
      expect.stringMatching(/FIL-01.*Filtro de aceite.*2/),
      expect.stringMatching(/PAS-07.*Pastillas de freno delanteras.*1/),
    ]);
  });

  it('[C-3] el mecánico no ve precios en las líneas', () => {
    const { container } = render(
      <LineasOrden lineas={[FILTRO, PASTILLAS]} verImportes={false} editable={false} />,
    );

    expect(container.textContent).not.toContain('€');
    expect(container.textContent).not.toMatch(/\d,\d\d/);
  });

  it('[C-7] el jefe ve el precio de cada unidad y lo que suma la línea', () => {
    render(<LineasOrden lineas={[FILTRO, PASTILLAS]} verImportes editable={false} />);

    const [filtro, pastillas] = filas().map((fila) => fila.textContent ?? '');

    expect(filtro).toContain('2 × 12,50 €');
    expect(filtro).toContain('25,00 €');
    expect(pastillas).toContain('1 × 48,90 €');
    expect(pastillas).toContain('48,90 €');
  });

  it('[D-13] un nombre largo sin espacios se parte dentro de la línea', () => {
    const largo = 'A'.repeat(80);
    render(
      <LineasOrden lineas={[{ ...FILTRO, nombre: largo }]} verImportes editable={false} />,
    );

    expect(screen.getByText(largo).closest('.wrap-anywhere')).not.toBeNull();
  });
});

const editable = () => {
  const accionCantidad = vi.fn<(datos: FormData) => void>();
  const accionQuitar = vi.fn<(datos: FormData) => void>();
  render(
    <LineasOrden
      lineas={[FILTRO, PASTILLAS]}
      verImportes
      editable
      accionCantidad={accionCantidad}
      accionQuitar={accionQuitar}
    />,
  );
  return { accionCantidad, accionQuitar };
};

describe('LineasOrden: sin editar', () => {
  it('sin editar no hay ningún control', () => {
    render(<LineasOrden lineas={[FILTRO]} verImportes editable={false} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });
});

describe('LineasOrden: editar', () => {
  it('cada línea deja cambiar su cantidad y quitarla', () => {
    editable();

    const [filtro] = filas();

    expect(within(filtro).getByRole('spinbutton', { name: 'Cantidad de Filtro de aceite' })).toBeTruthy();
    expect(within(filtro).getByRole('button', { name: 'Guardar' })).toBeTruthy();
    expect(within(filtro).getByRole('button', { name: 'Quitar' })).toBeTruthy();
  });

  it('[D-2] la cantidad parte de la actual y el navegador solo deja de 1 a 999', () => {
    editable();

    const cantidad = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Cantidad de Filtro de aceite',
    });

    expect([cantidad.value, cantidad.min, cantidad.max, cantidad.required]).toEqual([
      '2',
      '1',
      '999',
      true,
    ]);
  });

  it('Guardar manda a la acción la línea y la cantidad nueva', async () => {
    const { accionCantidad } = editable();

    const [filtro] = filas();
    fireEvent.change(within(filtro).getByRole('spinbutton'), { target: { value: '5' } });
    fireEvent.click(within(filtro).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(accionCantidad).toHaveBeenCalledTimes(1));
    const datos = accionCantidad.mock.calls[0][0];
    expect([datos.get('lineaId'), datos.get('cantidad')]).toEqual(['linea-1', '5']);
  });

  it('Quitar manda a la acción solo la línea', async () => {
    const { accionQuitar } = editable();

    const [, pastillas] = filas();
    fireEvent.click(within(pastillas).getByRole('button', { name: 'Quitar' }));

    await waitFor(() => expect(accionQuitar).toHaveBeenCalledTimes(1));
    expect([...accionQuitar.mock.calls[0][0].entries()]).toEqual([['lineaId', 'linea-2']]);
  });

  it('[D-13] todo botón de una línea mide al menos --toque de alto', () => {
    editable();

    const botones = screen.getAllByRole('button');

    expect(botones).toHaveLength(4);
    expect(botones.filter((boton) => ![...boton.classList].includes('min-h-toque'))).toEqual([]);
  });
});
