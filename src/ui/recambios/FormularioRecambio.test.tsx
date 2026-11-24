import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FormularioRecambio,
  type AccionGuardar,
  type EstadoDelFormulario,
  type RecambioVista,
} from './FormularioRecambio';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const RECAMBIO: RecambioVista = {
  id: '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7b64',
  referencia: 'FIL-01',
  nombre: 'Filtro de aceite',
  precio: '12,50 €',
  stock: 5,
  stockMinimo: 2,
  bajoMinimo: false,
};

const FALLO_DE_STOCK: EstadoDelFormulario = {
  ok: false,
  motivo: 'Revisa los campos con error',
  errores: { stock: 'Tiene que ser un número entero, cero o más' },
  valores: { stock: 'abc', stockMinimo: '2', precio: '12,5' },
};

// La acción de servidor de mentira: contesta con el estado que se le diga.
const accionQue = (estado: EstadoDelFormulario) => vi.fn<AccionGuardar>().mockResolvedValue(estado);

const campo = (etiqueta: string) => screen.getByLabelText<HTMLInputElement>(etiqueta);

const guardar = () => fireEvent.click(screen.getByRole('button', { name: /^Guardar/ }));

describe('FormularioRecambio: qué pide', () => {
  it('[C-3] el alta pide referencia, nombre, precio, stock y mínimo, vacíos y sin id', () => {
    const { container } = render(<FormularioRecambio accion={accionQue(null)} />);

    const etiquetas = ['Referencia', 'Nombre', 'Precio en euros', 'Stock', 'Stock mínimo'];

    expect(etiquetas.map((etiqueta) => campo(etiqueta).value)).toEqual(['', '', '', '', '']);
    expect(container.querySelector('input[name="id"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Guardar recambio' })).toBeTruthy();
  });

  it('[C-3] la edición pide stock, mínimo y precio con lo que tiene el recambio', () => {
    render(<FormularioRecambio recambio={RECAMBIO} accion={accionQue(null)} />);

    expect(campo('Stock').value).toBe('5');
    expect(campo('Stock mínimo').value).toBe('2');
    expect(campo('Precio en euros').value).toBe('12,50');
    expect(screen.queryByLabelText('Referencia')).toBeNull();
    expect(screen.queryByLabelText('Nombre')).toBeNull();
  });

  it.each([
    ['con miles', '1.234,56 €', '1234,56'],
    ['con millones', '21.474.836,47 €', '21474836,47'],
    ['sin céntimos', '0,00 €', '0,00'],
    ['sin precio', null, ''],
  ])('[D-5] el precio %s se escribe en el campo como se teclea', (_caso, precio, escrito) => {
    render(<FormularioRecambio recambio={{ ...RECAMBIO, precio }} accion={accionQue(null)} />);

    expect(campo('Precio en euros').value).toBe(escrito);
  });

  it('[C-3] los campos se teclean como números y con ayuda del teclado del móvil', () => {
    render(<FormularioRecambio accion={accionQue(null)} />);

    expect(campo('Stock').getAttribute('inputmode')).toBe('numeric');
    expect(campo('Stock mínimo').getAttribute('inputmode')).toBe('numeric');
    expect(campo('Precio en euros').getAttribute('inputmode')).toBe('decimal');
    expect(campo('Referencia').getAttribute('autocapitalize')).toBe('characters');
  });
});

describe('FormularioRecambio: qué manda', () => {
  it('[C-3] el alta manda los cinco campos y ningún id', async () => {
    const accion = accionQue(null);
    render(<FormularioRecambio accion={accion} />);

    fireEvent.change(campo('Referencia'), { target: { value: 'bat-12' } });
    fireEvent.change(campo('Nombre'), { target: { value: 'Batería 60 Ah' } });
    fireEvent.change(campo('Precio en euros'), { target: { value: '89,90' } });
    fireEvent.change(campo('Stock'), { target: { value: '3' } });
    fireEvent.change(campo('Stock mínimo'), { target: { value: '1' } });
    guardar();

    await waitFor(() => expect(accion).toHaveBeenCalledTimes(1));
    const datos = accion.mock.calls[0][1];
    expect(Object.fromEntries(datos)).toEqual({
      referencia: 'bat-12',
      nombre: 'Batería 60 Ah',
      precio: '89,90',
      stock: '3',
      stockMinimo: '1',
    });
  });

  it('[C-3] la edición manda lo cambiado y, sin pedirlos, el id, la referencia y el nombre', async () => {
    const accion = accionQue(null);
    render(<FormularioRecambio recambio={RECAMBIO} accion={accion} />);

    fireEvent.change(campo('Stock'), { target: { value: '1' } });
    guardar();

    await waitFor(() => expect(accion).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(accion.mock.calls[0][1])).toEqual({
      id: RECAMBIO.id,
      referencia: 'FIL-01',
      nombre: 'Filtro de aceite',
      precio: '12,50',
      stock: '1',
      stockMinimo: '2',
    });
  });
});

describe('FormularioRecambio: cuando hay errores', () => {
  it('[D-14] el error de un campo sale junto a ese campo y lo marca', async () => {
    render(<FormularioRecambio recambio={RECAMBIO} accion={accionQue(FALLO_DE_STOCK)} />);

    guardar();

    const stock = await waitFor(() => {
      const marcado = campo('Stock');
      expect(marcado.getAttribute('aria-invalid')).toBe('true');
      return marcado;
    });
    const explicacion = document.getElementById(stock.getAttribute('aria-describedby') ?? '');
    expect(explicacion?.textContent).toBe('Tiene que ser un número entero, cero o más');
    expect(campo('Stock mínimo').getAttribute('aria-invalid')).toBeNull();
    expect(campo('Precio en euros').getAttribute('aria-describedby')).toBeNull();
  });

  it('[D-14] el motivo se dice arriba del formulario', async () => {
    render(<FormularioRecambio recambio={RECAMBIO} accion={accionQue(FALLO_DE_STOCK)} />);

    guardar();

    expect((await screen.findByRole('alert')).textContent).toBe('Revisa los campos con error');
  });

  it('[D-14] tras un error se conserva lo que se había escrito, no se vuelve a lo anterior', async () => {
    render(<FormularioRecambio recambio={RECAMBIO} accion={accionQue(FALLO_DE_STOCK)} />);

    fireEvent.change(campo('Stock'), { target: { value: 'abc' } });
    fireEvent.change(campo('Precio en euros'), { target: { value: '12,5' } });
    guardar();

    await screen.findByRole('alert');
    expect(campo('Stock').value).toBe('abc');
    expect(campo('Precio en euros').value).toBe('12,5');
  });

  it('[D-14] un fallo sin campo (un permiso, un recambio que ya no está) solo se dice arriba', async () => {
    const motivo = 'No se pudo guardar el recambio. Puede que ya no exista.';
    const accion = accionQue({ ok: false, motivo, errores: {}, valores: {} });
    const { container } = render(<FormularioRecambio recambio={RECAMBIO} accion={accion} />);

    guardar();

    expect((await screen.findByRole('alert')).textContent).toBe(motivo);
    expect(container.querySelectorAll('[aria-invalid]')).toHaveLength(0);
  });
});

describe('FormularioRecambio: cuando guarda', () => {
  it('[C-3] al guardar bien lo dice, y el alta queda vacía para añadir otro', async () => {
    render(<FormularioRecambio accion={accionQue({ ok: true })} />);

    fireEvent.change(campo('Referencia'), { target: { value: 'bat-12' } });
    guardar();

    expect((await screen.findByRole('status')).textContent).toBe('Recambio guardado');
    await waitFor(() => expect(campo('Referencia').value).toBe(''));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('[D-13] mientras guarda, el botón queda desactivado para no enviar dos veces', async () => {
    // Se resuelve al final: una acción que no termina deja en espera las demás de la prueba.
    const { promise, resolve } = Promise.withResolvers<EstadoDelFormulario>();
    const accion = vi.fn<AccionGuardar>().mockReturnValue(promise);
    render(<FormularioRecambio recambio={RECAMBIO} accion={accion} />);
    const boton = () => screen.getByRole('button', { name: /^Guardar/ });

    guardar();
    await waitFor(() => expect(boton().hasAttribute('disabled')).toBe(true));
    resolve({ ok: true });

    await waitFor(() => expect(boton().hasAttribute('disabled')).toBe(false));
  });
});

describe('FormularioRecambio: cómo se ve', () => {
  it('[D-13] el botón y cada campo miden al menos --toque de alto', () => {
    const { container } = render(<FormularioRecambio accion={accionQue(null)} />);

    const medibles = [...container.querySelectorAll('input:not([type="hidden"]), button')];

    expect(medibles).toHaveLength(6);
    expect(medibles.filter((el) => ![...el.classList].includes('min-h-toque'))).toEqual([]);
  });

  it('[D-12] los avisos de error van en el color de la avería y no dependen solo del color', async () => {
    render(<FormularioRecambio recambio={RECAMBIO} accion={accionQue(FALLO_DE_STOCK)} />);

    guardar();

    const alerta = await screen.findByRole('alert');
    expect([...alerta.classList]).toContain('text-averia');
    expect(alerta.textContent?.length).toBeGreaterThan(0);
  });

  it('[C-3] dos formularios en la misma pantalla no mezclan sus campos', () => {
    render(
      <>
        <FormularioRecambio recambio={RECAMBIO} accion={accionQue(null)} />
        <FormularioRecambio recambio={{ ...RECAMBIO, stock: 9 }} accion={accionQue(null)} />
      </>,
    );

    const stocks = screen.getAllByLabelText<HTMLInputElement>('Stock');

    expect(stocks.map((entrada) => entrada.value)).toEqual(['5', '9']);
    expect(new Set(stocks.map((entrada) => entrada.id)).size).toBe(2);
  });

  it('sin acción, el formulario se dibuja y al guardar no rompe nada', async () => {
    render(<FormularioRecambio recambio={RECAMBIO} />);

    guardar();

    await waitFor(() => expect(screen.getByRole('button', { name: /^Guardar/ })).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
