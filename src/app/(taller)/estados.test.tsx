import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorDelTaller from './error';
import CargandoElTaller from './loading';

afterEach(cleanup);

describe('estados de las pantallas privadas', () => {
  it('[C-15][D-11] mientras carga dice «Cargando el taller…»', () => {
    render(<CargandoElTaller />);

    expect(screen.getByRole('status').textContent).toBe('Cargando el taller…');
  });

  // Reintentar vuelve a pedir la pantalla al servidor con `retry`; `reset` solo borraba el error y
  // volvía a pintar lo que ya había fallado (Next 16.3: docs de error.js).
  it('[C-15][D-11] si falla dice qué ha pasado y deja reintentar con retry', () => {
    const retry = vi.fn();
    render(<ErrorDelTaller error={new Error('fallo')} retry={retry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Algo ha fallado al cargar esta pantalla',
    );
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('[D-14] el error no enseña el mensaje técnico al usuario', () => {
    render(
      <ErrorDelTaller error={new Error('relation "miembros" does not exist')} retry={vi.fn()} />,
    );

    expect(document.body.textContent).not.toContain('miembros');
  });

  it('[D-13] cada pantalla abre su propio <main> y el botón mide al menos --toque', () => {
    const { container } = render(<ErrorDelTaller error={new Error('fallo')} retry={vi.fn()} />);

    const reintentar = screen.getByRole('button', { name: 'Reintentar' });

    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect([...reintentar.classList]).toContain('min-h-toque');
  });
});
