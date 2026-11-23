import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Navegacion } from './Navegacion';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue('/tablero');
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const dibujar = (cambios: Partial<Parameters<typeof Navegacion>[0]> = {}) =>
  render(
    <Navegacion
      taller="Taller Demo"
      nombre="Marta Soler"
      rol="jefe"
      accionSalir={vi.fn()}
      {...cambios}
    />,
  );

const navegacion = () => within(screen.getByRole('navigation', { name: 'Principal' }));
const enlace = (nombre: string) => navegacion().getByRole('link', { name: nombre });
const claseDe = (elemento: Element, clase: string) => [...elemento.classList].includes(clase);

describe('Navegacion: contenido', () => {
  it('[C-1] ofrece Tablero y Recambios', () => {
    dibujar();

    expect(enlace('Tablero').getAttribute('href')).toBe('/tablero');
    expect(enlace('Recambios').getAttribute('href')).toBe('/recambios');
  });

  it.each([
    ['jefe', 'Jefe de taller'],
    ['mecanico', 'Mecánico'],
  ] as const)('[C-3] el %s ve su nombre, su taller y su rol «%s»', (rol, etiqueta) => {
    dibujar({ rol });

    expect(screen.getByText('Taller Demo')).toBeTruthy();
    expect(screen.getByText('Marta Soler')).toBeTruthy();
    expect(screen.getByText(etiqueta)).toBeTruthy();
  });

  it('[C-1] Salir ejecuta la acción de salir', async () => {
    const accionSalir = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    dibujar({ accionSalir });

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));

    await waitFor(() => expect(accionSalir).toHaveBeenCalledTimes(1));
  });

  it('[D-13] el nombre del taller o de la persona, por largo que sea, se parte en su caja', () => {
    const largo = 'Q'.repeat(80);
    dibujar({ taller: largo, nombre: largo });

    const cajas = screen.getAllByText(largo);

    expect(cajas).toHaveLength(2);
    expect(cajas.map((caja) => claseDe(caja, 'wrap-anywhere'))).toEqual([true, true]);
  });
});

describe('Navegacion: dónde estás', () => {
  it.each([
    ['/tablero', 'Tablero'],
    ['/ordenes/nueva', 'Tablero'],
    ['/ordenes/abc-123', 'Tablero'],
    ['/recambios', 'Recambios'],
  ])('[C-1] en %s marca %s como la página actual', (ruta, actual) => {
    vi.mocked(usePathname).mockReturnValue(ruta);
    dibujar();

    const marcados = navegacion()
      .getAllByRole('link')
      .filter((destino) => destino.getAttribute('aria-current') === 'page')
      .map((destino) => destino.textContent);

    expect(marcados).toEqual([actual]);
  });

  it('[C-1] un enlace solo se marca si la ruta empieza por su sección entera', () => {
    vi.mocked(usePathname).mockReturnValue('/recambios-viejos');
    dibujar();

    const marcas = navegacion()
      .getAllByRole('link')
      .map((destino) => destino.getAttribute('aria-current'));

    expect(marcas).toEqual([null, null]);
  });
});

describe('Navegacion: medidas', () => {
  it('[D-13] los enlaces y el botón de salir miden al menos --toque de alto', () => {
    dibujar();

    const controles = [
      enlace('Tablero'),
      enlace('Recambios'),
      screen.getByRole('button', { name: 'Salir' }),
    ];

    expect(controles.map((control) => claseDe(control, 'min-h-toque'))).toEqual([true, true, true]);
  });

  it('[D-12] los iconos son decorativos: el texto de cada control ya dice qué hace', () => {
    const { container } = dibujar();

    const iconos = [...container.querySelectorAll('svg')];

    expect(iconos.length).toBeGreaterThanOrEqual(3);
    expect(iconos.filter((icono) => icono.getAttribute('aria-hidden') !== 'true')).toEqual([]);
  });
});
