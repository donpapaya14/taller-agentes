import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ListaRecambios, type RecambioVista } from './ListaRecambios';

afterEach(cleanup);

const recambio = (cambios: Partial<RecambioVista> = {}): RecambioVista => ({
  id: '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7b64',
  referencia: 'FIL-01',
  nombre: 'Filtro de aceite',
  precio: '12,50 €',
  stock: 5,
  stockMinimo: 2,
  bajoMinimo: false,
  ...cambios,
});

// Entran desordenados a propósito: el tercero es el único bajo mínimo.
const TRES = [
  recambio({ id: 'a', referencia: 'ZUM-09', nombre: 'Zumbador' }),
  recambio({ id: 'b', referencia: 'AMO-02', nombre: 'Amortiguador' }),
  recambio({
    id: 'c',
    referencia: 'PAS-07',
    nombre: 'Pastillas de freno',
    stock: 1,
    stockMinimo: 4,
    bajoMinimo: true,
  }),
];

const filas = () => screen.getAllByRole('article');

// La referencia es lo único de una fila que tiene esta forma: tres letras, guion y dos cifras.
const referenciaDe = (fila: HTMLElement) => within(fila).getByText(/^[A-Z]{3}-\d{2}$/).textContent;

describe('ListaRecambios: orden y marca de bajo mínimo', () => {
  it('[C-6] los recambios bajo mínimo salen primero y marcados', () => {
    render(<ListaRecambios recambios={TRES} puedeEditar={false} />);

    const [primera, ...resto] = filas();

    expect(referenciaDe(primera)).toBe('PAS-07');
    expect(within(primera).getByText('Bajo mínimo')).toBeTruthy();
    resto.forEach((fila) => expect(within(fila).queryByText('Bajo mínimo')).toBeNull());
    expect(screen.getAllByText('Bajo mínimo')).toHaveLength(1);
  });

  it('[C-6] el resto va por referencia', () => {
    render(<ListaRecambios recambios={TRES} puedeEditar={false} />);

    expect(filas().map(referenciaDe)).toEqual(['PAS-07', 'AMO-02', 'ZUM-09']);
  });

  it('[C-6] entre los que están bajo mínimo también va por referencia', () => {
    const recambios = [
      recambio({ id: 'a', referencia: 'ZUM-09', bajoMinimo: true }),
      recambio({ id: 'b', referencia: 'BAT-01' }),
      recambio({ id: 'c', referencia: 'AMO-02', bajoMinimo: true }),
    ];
    render(<ListaRecambios recambios={recambios} puedeEditar={false} />);

    expect(filas().map(referenciaDe)).toEqual(['AMO-02', 'ZUM-09', 'BAT-01']);
  });

  it('[C-6] no cambia el orden de la lista que recibe', () => {
    const recibida = [...TRES];

    render(<ListaRecambios recambios={recibida} puedeEditar={false} />);

    expect(recibida).toEqual(TRES);
  });

  it('[C-6] el stock es el dato grande de la fila y lleva su mínimo al lado', () => {
    render(<ListaRecambios recambios={[recambio()]} puedeEditar={false} />);

    const fila = screen.getByRole('article');
    const stock = within(fila).getByText('5');

    expect(within(fila).getByText('mín. 2')).toBeTruthy();
    expect([...stock.classList]).toEqual(expect.arrayContaining(['font-dato', 'text-columna']));
  });

  it('[C-6] el stock de un recambio bajo mínimo va en ámbar y el de los demás no', () => {
    render(<ListaRecambios recambios={TRES} puedeEditar={false} />);

    const [bajo, ...resto] = filas();

    expect([...within(bajo).getByText('1').classList]).toContain('text-ambar');
    resto.forEach((fila) => {
      expect([...within(fila).getByText('5').classList]).not.toContain('text-ambar');
    });
  });
});

describe('ListaRecambios: permisos', () => {
  it('[C-3] sin permiso de edición no hay formularios', () => {
    const { container } = render(<ListaRecambios recambios={TRES} puedeEditar={false} />);

    expect(container.querySelectorAll('input, select, textarea, form, details')).toHaveLength(0);
    expect(screen.queryByText('Editar')).toBeNull();
    expect(screen.queryByText('Añadir recambio')).toBeNull();
  });

  it('[C-3] el mecánico no ve precios', () => {
    const sinPrecio = TRES.map((r) => ({ ...r, precio: null }));
    const { container } = render(<ListaRecambios recambios={sinPrecio} puedeEditar={false} />);

    expect(container.textContent).not.toContain('€');
  });

  it('[C-3] el jefe ve el precio de cada recambio', () => {
    render(<ListaRecambios recambios={[recambio({ precio: '1.234,50 €' })]} puedeEditar />);

    expect(within(screen.getByRole('article')).getByText('1.234,50 €')).toBeTruthy();
  });

  it('[C-3] con permiso de edición hay «Añadir recambio» arriba y «Editar» en cada recambio', () => {
    render(<ListaRecambios recambios={TRES} puedeEditar />);

    const anadir = screen.getByText('Añadir recambio');
    const editar = screen.getAllByText('Editar');

    expect(editar).toHaveLength(3);
    expect(
      anadir.compareDocumentPosition(filas()[0]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    filas().forEach((fila) => expect(within(fila).getAllByText('Editar')).toHaveLength(1));
  });

  it('[D-13] los formularios llegan plegados y lo que los abre mide al menos --toque', () => {
    const { container } = render(<ListaRecambios recambios={TRES} puedeEditar />);

    const plegables = [...container.querySelectorAll('details')];

    expect(plegables).toHaveLength(4);
    plegables.forEach((plegable) => {
      expect(plegable.hasAttribute('open')).toBe(false);
      expect([...(plegable.querySelector('summary')?.classList ?? [])]).toContain('min-h-toque');
    });
  });

  it('[C-3] cada recambio edita el suyo: los formularios no comparten identificadores', () => {
    const { container } = render(<ListaRecambios recambios={TRES} puedeEditar />);

    const ids = [...container.querySelectorAll('[id]')].map((elemento) => elemento.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('ListaRecambios: estado vacío', () => {
  it('[C-15][D-11] lista vacía muestra su texto', () => {
    render(<ListaRecambios recambios={[]} puedeEditar={false} />);

    expect(screen.getByText('El almacén está vacío')).toBeTruthy();
    expect(screen.queryAllByRole('article')).toEqual([]);
  });

  it('[C-15][D-11] con permiso de edición, un almacén vacío deja añadir el primer recambio', () => {
    render(<ListaRecambios recambios={[]} puedeEditar />);

    expect(screen.getByText('El almacén está vacío')).toBeTruthy();
    expect(screen.getByText('Añadir recambio')).toBeTruthy();
    expect(screen.queryByText('Editar')).toBeNull();
  });

  it('[C-15][D-11] con recambios no hay estado vacío', () => {
    render(<ListaRecambios recambios={TRES} puedeEditar={false} />);

    expect(screen.queryByText('El almacén está vacío')).toBeNull();
  });
});
