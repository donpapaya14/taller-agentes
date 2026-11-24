import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Boton, clasesDeBoton } from './Boton';
import { PARES } from './pares-contraste';

afterEach(cleanup);

const VARIANTES = ['principal', 'secundario', 'peligro'] as const;

// jsdom no aplica hojas de estilo: aquí se comprueban las clases que dan el aspecto. El navegador
// real lo mide la prueba de tests/e2e.
const clasesDe = (elemento: Element) => [...elemento.classList];

describe('Boton desactivado', () => {
  it.each(VARIANTES)(
    '[D-10] el botón %s desactivado se apaga: chapa, raya y texto de acero, sin dedo de la lámpara',
    (variante) => {
      render(
        <Boton variante={variante} disabled>
          Guardar
        </Boton>,
      );

      const boton = screen.getByRole('button', { name: 'Guardar' });

      expect(boton.hasAttribute('disabled')).toBe(true);
      expect(clasesDe(boton)).toEqual(
        expect.arrayContaining([
          'disabled:cursor-not-allowed',
          'disabled:border-raya',
          'disabled:bg-chapa',
          'disabled:text-acero',
        ]),
      );
    },
  );

  it('[D-10] el par de un botón apagado, acero sobre chapa, es uno de los que mide el test de contraste', () => {
    expect(PARES).toContainEqual({ texto: 'acero', fondo: 'chapa', minimo: 4.5 });
  });

  it.each(VARIANTES)(
    '[D-13] el efecto de pasar por encima del botón %s solo se aplica si está activo',
    (variante) => {
      const alPasarPorEncima = clasesDeBoton(variante)
        .split(' ')
        .filter((clase) => clase.includes('hover:'));

      expect(alPasarPorEncima.filter((clase) => !clase.startsWith('not-disabled:'))).toEqual([]);
    },
  );

  it.each(VARIANTES)('[D-13] el botón %s sigue midiendo al menos --toque', (variante) => {
    render(<Boton variante={variante}>Guardar</Boton>);

    expect(clasesDe(screen.getByRole('button', { name: 'Guardar' }))).toContain('min-h-toque');
  });
});
