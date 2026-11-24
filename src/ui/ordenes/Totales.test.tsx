import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Totales } from './Totales';

afterEach(cleanup);

describe('Totales', () => {
  it('[C-7] enseña la base, el IVA y el total en euros', () => {
    render(<Totales base={9250} iva={1943} total={11193} />);

    const filas = screen.getAllByRole('term').map((termino) => [
      termino.textContent,
      termino.nextElementSibling?.textContent,
    ]);

    expect(filas).toEqual([
      ['Base imponible', '92,50 €'],
      ['IVA (21 %)', '19,43 €'],
      ['Total', '111,93 €'],
    ]);
  });

  it('[C-7] con la orden vacía todo es cero', () => {
    render(<Totales base={0} iva={0} total={0} />);

    expect(screen.getAllByText('0,00 €')).toHaveLength(3);
  });

  it('[C-7] separa los miles con punto', () => {
    render(<Totales base={123456789} iva={25925925} total={149382714} />);

    expect(screen.getByText('1.493.827,14 €')).toBeTruthy();
  });
});
