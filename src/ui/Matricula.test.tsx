import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Matricula } from './Matricula';

afterEach(cleanup);

// /ordenes/nueva dibuja la placa mientras se escribe: recibe matrículas mal escritas de cualquier
// largo antes de que la validación las rechace.
const MATRICULA_LARGA = '1234 ABCDEFGHIJKLMNOPQRST';
const TAMANOS = ['normal', 'grande'] as const;

// jsdom no calcula el layout: aquí se comprueban las clases que lo evitan. El ancho real a 390 px
// lo mide un navegador (D-13).
const clasesDe = (elemento: Element | null) => [...(elemento?.classList ?? [])];

describe('Matricula: texto más largo que la pantalla', () => {
  it.each(TAMANOS)('[D-13] la placa %s no pasa del ancho de su contenedor', (tamano) => {
    render(<Matricula texto={MATRICULA_LARGA} tamano={tamano} />);

    const placa = screen.getByText(MATRICULA_LARGA).closest('.matricula');

    expect(clasesDe(placa)).toContain('max-w-full');
  });

  it.each(TAMANOS)(
    '[D-13] los caracteres de la placa %s se recortan en una sola línea con puntos suspensivos',
    (tamano) => {
      render(<Matricula texto={MATRICULA_LARGA} tamano={tamano} />);

      expect(clasesDe(screen.getByText(MATRICULA_LARGA))).toContain('truncate');
    },
  );
});
