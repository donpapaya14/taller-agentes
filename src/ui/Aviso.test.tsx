import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Aviso } from './Aviso';

afterEach(cleanup);

describe('Aviso', () => {
  it('[D-14] un error se anuncia como alerta con su texto', () => {
    render(<Aviso tipo="error" texto="Otra persona ya movió esta orden. Recarga el tablero" />);

    expect(screen.getByRole('alert').textContent).toBe(
      'Otra persona ya movió esta orden. Recarga el tablero',
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('[D-14] una confirmación se anuncia como estado, sin alarmar', () => {
    render(<Aviso tipo="ok" texto="Orden entregada. Factura F-2026-0001" />);

    expect(screen.getByRole('status').textContent).toBe('Orden entregada. Factura F-2026-0001');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('[D-10] el error va en avería y la confirmación en testigo, los dos sobre chapa', () => {
    const { rerender } = render(<Aviso tipo="error" texto="Falló" />);
    const clasesDelError = [...screen.getByRole('alert').classList];

    rerender(<Aviso tipo="ok" texto="Hecho" />);
    const clasesDeLaConfirmacion = [...screen.getByRole('status').classList];

    expect(clasesDelError).toEqual(expect.arrayContaining(['text-averia', 'bg-chapa']));
    expect(clasesDeLaConfirmacion).toEqual(expect.arrayContaining(['text-testigo', 'bg-chapa']));
  });
});
