import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorDeLaApp from './error';
import { salir } from './login/acciones';

vi.mock('./login/acciones', () => ({ salir: vi.fn() }));

beforeEach(() => {
  vi.mocked(salir).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const dibujar = (retry = vi.fn(), error: unknown = new Error('fallo')) =>
  render(<ErrorDeLaApp error={error} retry={retry} />);

describe('pantalla de error de toda la app', () => {
  it('[D-14] dice en español que algo ha fallado y qué hacer', () => {
    dibujar();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Algo ha fallado');
    expect(
      screen.getByText('Vuelve a intentarlo. Si sigue pasando, sal y entra de nuevo.'),
    ).toBeTruthy();
  });

  it('[D-14] no enseña el mensaje técnico del fallo', () => {
    dibujar(vi.fn(), new Error('relation "miembros" does not exist'));

    expect(document.body.textContent).not.toContain('miembros');
  });

  it('[D-14] Reintentar vuelve a pedir la pantalla al servidor con retry', () => {
    const retry = vi.fn();
    dibujar(retry);

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('[D-14] Salir cierra la sesión: quien no tiene taller no se queda sin salida', async () => {
    dibujar();

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));

    await waitFor(() => expect(salir).toHaveBeenCalledTimes(1));
  });

  it('[D-13] abre un solo <main> y los dos botones miden al menos --toque', () => {
    const { container } = dibujar();

    const clasesDeLosBotones = ['Reintentar', 'Salir'].map((nombre) => [
      ...screen.getByRole('button', { name: nombre }).classList,
    ]);

    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(clasesDeLosBotones.map((clases) => clases.includes('min-h-toque'))).toEqual([
      true,
      true,
    ]);
  });
});
