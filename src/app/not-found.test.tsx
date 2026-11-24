import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import NoEncontrada from './not-found';

afterEach(cleanup);

describe('página 404', () => {
  it('[D-14] avisa en español de que la página no existe', () => {
    render(<NoEncontrada />);

    expect(screen.getByRole('heading', { level: 1, name: 'Esa página no existe' })).toBeTruthy();
    expect(
      screen.getByText(/la dirección esté mal escrita o que el enlace ya no sirva/),
    ).toBeTruthy();
  });

  it('[D-14] ofrece volver al inicio con un botón de al menos --toque de alto', () => {
    render(<NoEncontrada />);

    const volver = screen.getByRole('link', { name: 'Volver al inicio' });

    expect(volver.getAttribute('href')).toBe('/');
    expect([...volver.classList]).toContain('min-h-toque');
  });

  it('[D-12] no deja nada del texto en inglés de Next', () => {
    render(<NoEncontrada />);

    expect(document.body.textContent).not.toMatch(/could not be found|404/i);
  });

  it('[C-17] es la pantalla del taller: lleva la franja de seguridad y el titular en la tipografía de titulares', () => {
    const { container } = render(<NoEncontrada />);

    expect(container.querySelector('.franja-seguridad')).not.toBeNull();
    expect([...screen.getByRole('heading', { level: 1 }).classList]).toContain('font-titular');
  });
});
