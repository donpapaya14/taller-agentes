import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LineaDeRondas } from './LineaDeRondas';

afterEach(cleanup);

const URL_REPO = 'https://github.com/donpapaya14/taller-agentes';
const COMMIT = 'b264d4fa3652df75709525fb2b6999de9bd67a31';

const fallo = (directriz: string, evidencia = `Evidencia medida para ${directriz}`) => ({
  directriz,
  archivo: `src/ui/${directriz}.tsx`,
  descripcion: `Descripción del fallo de ${directriz}`,
  evidencia,
});

const ronda = (numero: number, veredicto: 'PASA' | 'FALLA', fallos = [fallo('D-13')]) => ({
  ronda: numero,
  fecha: '2026-11-23',
  commitRevisado: COMMIT,
  veredicto,
  fallos: veredicto === 'PASA' ? [] : fallos,
});

const feature = (rondas: ReturnType<typeof ronda>[]) => ({
  id: 'f01-sistema-visual',
  titulo: 'Sistema visual y tablero',
  resumen: 'Los tokens de color, tipografía y espaciado de FOSO.',
  rondas,
});

const dibujar = (rondas: ReturnType<typeof ronda>[]) =>
  render(<LineaDeRondas feature={feature(rondas)} urlRepo={URL_REPO} />);

const piezas = (contenedor: HTMLElement) => [...contenedor.querySelectorAll('details')];

describe('LineaDeRondas: una pieza por ronda', () => {
  it('[C-12] dibuja una pieza por ronda con su veredicto y los fallos dentro', () => {
    const { container } = dibujar([
      ronda(1, 'FALLA', [fallo('D-13'), fallo('D-9')]),
      ronda(2, 'PASA'),
    ]);

    const [queFalla, quePasa] = piezas(container);

    expect(piezas(container)).toHaveLength(2);
    expect(within(queFalla).getByText('2 fallos')).toBeTruthy();
    expect(within(quePasa).getByText('Pasa')).toBeTruthy();
    expect(screen.getByText('Sistema visual y tablero')).toBeTruthy();
    expect(screen.getByText('Los tokens de color, tipografía y espaciado de FOSO.')).toBeTruthy();
    ['D-13', 'D-9'].forEach((directriz) => {
      expect(within(queFalla).getByText(directriz)).toBeTruthy();
      expect(within(queFalla).getByText(`Descripción del fallo de ${directriz}`)).toBeTruthy();
      expect(within(queFalla).getByText(`src/ui/${directriz}.tsx`)).toBeTruthy();
      expect(within(queFalla).getByText(`Evidencia medida para ${directriz}`)).toBeTruthy();
    });
  });

  it('[C-12] la evidencia va en la tipografía de los datos', () => {
    dibujar([ronda(1, 'FALLA')]);

    const evidencia = screen.getByText('Evidencia medida para D-13');

    expect([...evidencia.classList]).toContain('font-dato');
  });

  it('[C-12] el commit revisado enlaza al commit del repositorio', () => {
    const { container } = dibujar([ronda(1, 'FALLA'), ronda(2, 'PASA')]);

    const enlaces = piezas(container).map((pieza) => within(pieza).getByRole('link'));

    expect(enlaces.map((enlace) => enlace.getAttribute('href'))).toEqual([
      `${URL_REPO}/commit/${COMMIT}`,
      `${URL_REPO}/commit/${COMMIT}`,
    ]);
    expect(enlaces.map((enlace) => enlace.textContent)).toEqual(['b264d4f', 'b264d4f']);
  });

  it('[C-12] enseña la fecha de la revisión y su número de ronda', () => {
    dibujar([ronda(1, 'FALLA'), ronda(2, 'PASA')]);

    expect(screen.getByText('Ronda 1')).toBeTruthy();
    expect(screen.getByText('Ronda 2')).toBeTruthy();
    expect(screen.getAllByText(/2026-11-23/)).toHaveLength(2);
  });

  it('[C-12] usa el singular con un solo fallo', () => {
    dibujar([ronda(1, 'FALLA', [fallo('D-13')])]);

    expect(screen.getByText('1 fallo')).toBeTruthy();
    expect(screen.queryByText('1 fallos')).toBeNull();
  });

  it('[C-12] una ronda que falla sin fallos detallados no dice «0 fallos»', () => {
    // El esquema admite FALLA con un comando en rojo y ningún fallo (docs/SPEC.md, P-4).
    dibujar([ronda(1, 'FALLA', [])]);

    expect(screen.queryByText(/0 fallos/)).toBeNull();
    expect(screen.getByText('Falla')).toBeTruthy();
  });
});

describe('LineaDeRondas: estados y medidas', () => {
  it('[C-15][D-11] una feature sin rondas muestra su estado vacío', () => {
    const { container } = dibujar([]);

    expect(screen.getByText('Todavía sin revisar')).toBeTruthy();
    expect(piezas(container)).toEqual([]);
  });

  it('[C-12] el color del veredicto sale de los testigos: avería si falla, testigo si pasa', () => {
    dibujar([ronda(1, 'FALLA'), ronda(2, 'PASA')]);

    const clases = (texto: string) => [...screen.getByText(texto).classList];

    expect(clases('1 fallo')).toContain('text-averia');
    expect(clases('Pasa')).toContain('text-testigo');
  });

  it('[D-13] la pieza se abre desde un área de al menos --toque y los textos largos se parten', () => {
    const largo = 'x'.repeat(120);
    const { container } = dibujar([ronda(1, 'FALLA', [fallo('D-13', largo)])]);

    const resumen = piezas(container)[0].querySelector('summary');

    expect([...(resumen?.classList ?? [])]).toContain('min-h-toque');
    expect([...screen.getByText(largo).classList]).toContain('wrap-anywhere');
    expect([...screen.getByText('Descripción del fallo de D-13').classList]).toContain(
      'wrap-anywhere',
    );
  });
});
