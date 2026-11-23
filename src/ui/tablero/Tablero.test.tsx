import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MUESTRA } from './muestra';
import { Tablero, type OrdenTablero } from './Tablero';

afterEach(cleanup);

const orden = (cambios: Partial<OrdenTablero> = {}): OrdenTablero => ({
  id: 'orden-1',
  matricula: '4821 KLM',
  vehiculo: 'Seat León',
  cliente: 'Lucía Ferrer',
  estado: 'recibido',
  descripcion: 'Ruido metálico al frenar',
  ...cambios,
});

const columnas = () => screen.getAllByRole('region');

describe('Tablero: columnas', () => {
  it('[C-10] agrupa las órdenes en cuatro columnas en orden', () => {
    render(<Tablero ordenes={MUESTRA} puedeEntregar />);

    const titulos = columnas().map(
      (columna) => within(columna).getByRole('heading', { level: 2 }).textContent,
    );
    const tarjetas = columnas().map((columna) => within(columna).queryAllByRole('article').length);

    expect(titulos).toEqual(['Recibido', 'En reparación', 'Listo', 'Entregado']);
    expect(tarjetas).toEqual([3, 3, 2, 1]);
  });

  it('[C-10][C-15][D-11] una columna sin órdenes muestra su estado vacío', () => {
    render(<Tablero ordenes={[]} puedeEntregar />);

    expect(columnas().map((columna) => columna.textContent)).toEqual([
      expect.stringContaining('Nada recibido hoy'),
      expect.stringContaining('Ningún coche en el elevador'),
      expect.stringContaining('Nada pendiente de recoger'),
      expect.stringContaining('Aún no se ha entregado nada'),
    ]);
    expect(screen.queryAllByRole('article')).toEqual([]);
  });

  it('[C-10] la muestra son nueve órdenes con matrícula de cuatro cifras y tres consonantes', () => {
    const matriculaEspanola = /^\d{4} [BCDFGHJKLMNPRSTVWXYZ]{3}$/;

    expect(new Set(MUESTRA.map(({ id }) => id)).size).toBe(9);
    expect(MUESTRA.filter(({ matricula }) => !matriculaEspanola.test(matricula))).toEqual([]);
  });
});

describe('Tablero: tarjeta', () => {
  it('[C-10] cada tarjeta muestra matrícula, vehículo, cliente y el botón de su siguiente estado', () => {
    render(<Tablero ordenes={[orden()]} puedeEntregar={false} />);

    const tarjeta = screen.getByRole('article');
    const boton = within(tarjeta).getByRole('button', { name: 'Pasar a en reparación' });

    expect(tarjeta.textContent).toContain('4821 KLM');
    expect(tarjeta.textContent).toContain('Seat León');
    expect(tarjeta.textContent).toContain('Lucía Ferrer');
    expect(boton.getAttribute('type')).toBe('submit');
  });

  it('[C-10] la matrícula enlaza a la ficha de la orden', () => {
    render(<Tablero ordenes={[orden({ id: 'orden-7' })]} puedeEntregar={false} />);

    const enlace = screen.getByRole('link', { name: /4821 KLM/ });

    expect(enlace.getAttribute('href')).toBe('/ordenes/orden-7');
  });

  it('[C-10] avanzar manda a la acción el id de la orden y su estado de origen', async () => {
    const accionAvanzar = vi.fn<(datos: FormData) => void>();
    render(
      <Tablero
        ordenes={[orden({ id: 'orden-7', estado: 'en_reparacion' })]}
        puedeEntregar={false}
        accionAvanzar={accionAvanzar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pasar a listo' }));

    await waitFor(() => expect(accionAvanzar).toHaveBeenCalledTimes(1));
    const datos = accionAvanzar.mock.calls[0][0];
    expect([datos.get('id'), datos.get('de')]).toEqual(['orden-7', 'en_reparacion']);
  });
});

describe('Tablero: entrega', () => {
  it('[C-3] sin permiso de entrega no aparece Entregar', () => {
    render(<Tablero ordenes={[orden({ estado: 'listo' })]} puedeEntregar={false} />);

    expect(screen.queryByText('Entregar')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('[C-3] con permiso de entrega, una orden lista ofrece Entregar, que lleva a su ficha', () => {
    render(<Tablero ordenes={[orden({ id: 'orden-3', estado: 'listo' })]} puedeEntregar />);

    const entregar = screen.getByRole('link', { name: 'Entregar' });

    expect(entregar.getAttribute('href')).toBe('/ordenes/orden-3');
  });

  it('[C-10] una orden entregada ya no ofrece ninguna acción', () => {
    render(<Tablero ordenes={[orden({ estado: 'entregado' })]} puedeEntregar />);

    const tarjeta = screen.getByRole('article');

    expect(within(tarjeta).queryByRole('button')).toBeNull();
    expect(
      within(tarjeta)
        .getAllByRole('link')
        .map((enlace) => enlace.textContent),
    ).toEqual([expect.stringContaining('4821 KLM')]);
  });
});
