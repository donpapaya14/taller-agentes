import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormularioOrden, type EstadoFormulario } from './FormularioOrden';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const VEHICULOS = [
  { id: 'vehiculo-1', matricula: '1234BCD', etiqueta: 'Seat Ibiza' },
  { id: 'vehiculo-2', matricula: '5678FGH', etiqueta: '' },
];

const SIN_ERRORES: EstadoFormulario = { errores: {}, motivo: null, valores: {} };

type Accion = (previo: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

const accionQue = (estado: EstadoFormulario = SIN_ERRORES) =>
  vi.fn<Accion>().mockResolvedValue(estado);

const dibujar = (accion: Accion = accionQue(), vehiculos = VEHICULOS) =>
  render(<FormularioOrden vehiculos={vehiculos} accion={accion} />);

const escribir = (campo: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(campo), { target: { value: valor } });

const elegir = (opcion: string) =>
  fireEvent.change(screen.getByLabelText('Vehículo'), { target: { value: opcion } });

const CAMPOS_NUEVOS = ['Matrícula', 'Marca', 'Modelo', 'Nombre del cliente', 'Teléfono del cliente'];

const rellenarVehiculoNuevo = () => {
  elegir('nuevo');
  escribir('Matrícula', '1234 bcd');
  escribir('Marca', 'Seat');
  escribir('Modelo', 'Ibiza');
  escribir('Nombre del cliente', 'Marta Ruiz');
  escribir('Teléfono del cliente', '612 345 678');
  escribir('Qué hay que hacer', 'Cambio de aceite');
};

const enviar = () => fireEvent.click(screen.getByRole('button', { name: 'Crear orden' }));

describe('FormularioOrden: lo que pide', () => {
  it('[C-11] pide el vehículo y lo que hay que hacer, y los vehículos existentes se pueden elegir', () => {
    dibujar();

    const opciones = within(screen.getByLabelText('Vehículo')).getAllByRole('option');

    expect(opciones.map((opcion) => opcion.textContent)).toEqual([
      'Elige un vehículo',
      '1234BCD · Seat Ibiza',
      '5678FGH',
      'Vehículo nuevo',
    ]);
    expect(screen.getByLabelText('Qué hay que hacer')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Crear orden' })).toBeTruthy();
  });

  it('[C-11] los datos del vehículo nuevo no están hasta elegir «Vehículo nuevo»', () => {
    dibujar();

    expect(CAMPOS_NUEVOS.filter((campo) => screen.queryByLabelText(campo) !== null)).toEqual([]);

    elegir('nuevo');

    expect(CAMPOS_NUEVOS.filter((campo) => screen.queryByLabelText(campo) === null)).toEqual([]);
  });

  it('[C-11] elegir otra vez un vehículo existente esconde los datos del nuevo', () => {
    dibujar();
    elegir('nuevo');

    elegir('vehiculo-1');

    expect(screen.queryByLabelText('Matrícula')).toBeNull();
  });

  it('[C-11] sin vehículos en el taller ya pide los datos del vehículo nuevo', () => {
    dibujar(accionQue(), []);

    expect(CAMPOS_NUEVOS.filter((campo) => screen.queryByLabelText(campo) === null)).toEqual([]);
  });

  it('[D-2] cada campo trae el tope y el tipo de teclado que le corresponde', () => {
    dibujar();
    elegir('nuevo');

    const atributos = (campo: string) => {
      const entrada = screen.getByLabelText<HTMLInputElement>(campo);
      return [entrada.maxLength, entrada.getAttribute('inputmode'), entrada.required];
    };

    expect(atributos('Marca')).toEqual([40, null, true]);
    expect(atributos('Modelo')).toEqual([40, null, true]);
    expect(atributos('Nombre del cliente')).toEqual([80, null, true]);
    expect(atributos('Teléfono del cliente')).toEqual([-1, 'tel', true]);
    expect(screen.getByLabelText<HTMLTextAreaElement>('Qué hay que hacer').maxLength).toBe(500);
  });
});

describe('FormularioOrden: la matrícula como placa', () => {
  it('[C-11] la matrícula escrita se dibuja como placa mientras se escribe', () => {
    dibujar();
    elegir('nuevo');

    expect(document.querySelector('.matricula')).toBeNull();

    escribir('Matrícula', '1234 bcd');

    expect(document.querySelector('.matricula-caracteres')?.textContent).toBe('1234 BCD');
  });

  it('[C-11] sin nada escrito no hay placa', () => {
    dibujar();
    elegir('nuevo');
    escribir('Matrícula', 'ab');

    escribir('Matrícula', '   ');

    expect(document.querySelector('.matricula')).toBeNull();
  });
});

describe('FormularioOrden: lo que envía', () => {
  it('[C-11] con un vehículo existente manda su id y nada del vehículo nuevo', async () => {
    const accion = accionQue();
    dibujar(accion);

    elegir('vehiculo-1');
    escribir('Qué hay que hacer', 'Cambio de aceite');
    enviar();

    await waitFor(() => expect(accion).toHaveBeenCalledTimes(1));
    expect([...accion.mock.calls[0][1].entries()]).toEqual([
      ['vehiculoId', 'vehiculo-1'],
      ['descripcion', 'Cambio de aceite'],
    ]);
  });

  it('[C-11] con vehículo nuevo manda el id vacío y los cinco datos', async () => {
    const accion = accionQue();
    dibujar(accion);

    rellenarVehiculoNuevo();
    enviar();

    await waitFor(() => expect(accion).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(accion.mock.calls[0][1])).toEqual({
      vehiculoId: '',
      matricula: '1234 bcd',
      marca: 'Seat',
      modelo: 'Ibiza',
      clienteNombre: 'Marta Ruiz',
      clienteTelefono: '612 345 678',
      descripcion: 'Cambio de aceite',
    });
  });

  // Una acción que no termina no puede quedar colgada al acabar el test: React junta las
  // transiciones que empiezan mientras hay una acción pendiente y las de los tests siguientes
  // no llegarían a pintarse.
  it('[D-13] mientras se crea, el botón queda desactivado para no crear dos órdenes', async () => {
    const { promise, resolve } = Promise.withResolvers<EstadoFormulario>();
    const accion = vi.fn<Accion>().mockReturnValue(promise);
    dibujar(accion);
    rellenarVehiculoNuevo();
    const boton = () => screen.getByRole('button', { name: 'Crear orden' });

    enviar();

    await waitFor(() => expect(boton().hasAttribute('disabled')).toBe(true));
    await act(async () => resolve(SIN_ERRORES));
    await waitFor(() => expect(boton().hasAttribute('disabled')).toBe(false));
  });
});

describe('FormularioOrden: cuando algo no va bien', () => {
  const ERRORES = {
    matricula: 'Matrícula no válida. Ejemplo: 1234 BCD',
    clienteTelefono: 'Teléfono no válido. Nueve cifras, por ejemplo 612 345 678',
    descripcion: 'Describe la avería o el trabajo (entre 5 y 500 letras)',
  };

  const conErrores = (): EstadoFormulario => ({
    errores: ERRORES,
    motivo: null,
    valores: {
      matricula: '12',
      marca: 'Seat',
      modelo: 'Ibiza',
      clienteNombre: 'Marta Ruiz',
      clienteTelefono: '1',
      descripcion: 'a',
    },
  });

  it('[C-11][D-2] cada error sale junto a su campo y el campo lo señala', async () => {
    dibujar(accionQue(conErrores()));
    rellenarVehiculoNuevo();

    enviar();

    for (const [campo, mensaje] of [
      ['Matrícula', ERRORES.matricula],
      ['Teléfono del cliente', ERRORES.clienteTelefono],
      ['Qué hay que hacer', ERRORES.descripcion],
    ]) {
      const error = await screen.findByText(mensaje);
      const entrada = screen.getByLabelText(campo);

      expect(entrada.getAttribute('aria-invalid')).toBe('true');
      expect(entrada.getAttribute('aria-describedby')).toBe(error.id);
    }
    expect(screen.getByLabelText('Marca').getAttribute('aria-invalid')).toBeNull();
  });

  it('[C-11] los datos escritos se conservan para corregir solo lo que falla', async () => {
    dibujar(accionQue(conErrores()));
    rellenarVehiculoNuevo();

    enviar();

    await screen.findByText(ERRORES.matricula);
    expect(
      ['Marca', 'Modelo', 'Nombre del cliente'].map(
        (campo) => screen.getByLabelText<HTMLInputElement>(campo).value,
      ),
    ).toEqual(['Seat', 'Ibiza', 'Marta Ruiz']);
  });

});

describe('FormularioOrden: los fallos que no son de un campo de texto', () => {
  it('[D-14] un fallo que no es de un campo se explica encima del formulario', async () => {
    dibujar(
      accionQue({ errores: {}, motivo: 'No se pudo crear la orden. Inténtalo de nuevo.', valores: {} }),
    );
    rellenarVehiculoNuevo();

    enviar();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'No se pudo crear la orden. Inténtalo de nuevo.',
    );
  });

  it('[C-11] el error de elegir vehículo sale junto al selector', async () => {
    dibujar(
      accionQue({ errores: { vehiculoId: 'Elige un vehículo' }, motivo: null, valores: {} }),
    );
    elegir('vehiculo-2');
    escribir('Qué hay que hacer', 'Cambio de aceite');

    enviar();

    const error = await screen.findByText('Elige un vehículo', { selector: 'p' });
    expect(screen.getByLabelText('Vehículo').getAttribute('aria-describedby')).toBe(error.id);
  });
});

describe('FormularioOrden: el móvil', () => {
  it('[D-13] el selector, los campos y el botón miden al menos --toque de alto', () => {
    dibujar();
    elegir('nuevo');

    const controles = [
      screen.getByLabelText('Vehículo'),
      ...CAMPOS_NUEVOS.map((campo) => screen.getByLabelText(campo)),
      screen.getByLabelText('Qué hay que hacer'),
      screen.getByRole('button', { name: 'Crear orden' }),
    ];

    expect(controles.filter((control) => ![...control.classList].includes('min-h-toque'))).toEqual(
      [],
    );
  });

  it('[D-13] la placa dispone de un contenedor del que tomar su tamaño', () => {
    dibujar();
    elegir('nuevo');
    escribir('Matrícula', '1234 bcd');

    expect(document.querySelector('.matricula')?.closest('.\\@container')).not.toBeNull();
  });
});
