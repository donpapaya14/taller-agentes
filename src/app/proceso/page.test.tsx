import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { leerProceso, type FeatureConRondas } from '@/adaptadores/proceso/leer-rondas';
import Proceso, { dynamic } from './page';

vi.mock('@/adaptadores/proceso/leer-rondas', async (importarOriginal) => ({
  ...(await importarOriginal<typeof import('@/adaptadores/proceso/leer-rondas')>()),
  leerProceso: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const URL_REPO = 'https://github.com/donpapaya14/taller-agentes';

const ronda = (numero: number, falla: boolean, fallos = 0): FeatureConRondas['rondas'][number] => ({
  feature: 'f0',
  ronda: numero,
  fecha: '2026-11-23',
  commitRevisado: 'b264d4fa3652df75709525fb2b6999de9bd67a31',
  veredicto: falla ? 'FALLA' : 'PASA',
  comandos: [{ comando: 'npm run check', resultado: falla ? 'FALLO' : 'OK', resumen: 'resumen' }],
  fallos: Array.from({ length: fallos }, (_, i) => ({
    directriz: 'D-13',
    archivo: 'src/ui/Matricula.tsx',
    descripcion: `Descripción del fallo ${i + 1}`,
    evidencia: `Evidencia del fallo ${i + 1}`,
  })),
  observaciones: '',
});

const feature = (titulo: string, rondas: FeatureConRondas['rondas']): FeatureConRondas => ({
  id: `f-${titulo}`,
  titulo,
  resumen: `Resumen de ${titulo}`,
  estado: 'hecha',
  rondas,
});

const conProceso = (features: FeatureConRondas[]) => {
  vi.mocked(leerProceso).mockReturnValue(features);
  return render(<Proceso />);
};

describe('/proceso: construcción', () => {
  it('[C-12] es una página estática, sin depender de la petición', () => {
    expect(dynamic).toBe('force-static');
  });

  it('[C-12] lee las rondas de la carpeta proceso del proyecto', () => {
    conProceso([]);

    expect(leerProceso).toHaveBeenCalledWith(path.join(process.cwd(), 'proceso'));
  });

  it('[C-12] no lleva JavaScript de cliente', () => {
    const archivos = [
      'page.tsx',
      '../../ui/proceso/LineaDeRondas.tsx',
      '../../ui/proceso/TresAgentes.tsx',
    ];

    const conCliente = archivos.filter((archivo) =>
      /['"]use client['"]/.test(readFileSync(path.join(import.meta.dirname, archivo), 'utf8')),
    );

    expect(conCliente).toEqual([]);
  });
});

describe('/proceso: contenido', () => {
  it('[C-12] titula «Cómo se construyó» y cuenta quién reparte, quién programa y quién revisa', () => {
    conProceso([]);

    expect(screen.getByRole('heading', { level: 1, name: 'Cómo se construyó' })).toBeTruthy();
    expect(screen.getByText(/informes reales de cada revisión/)).toBeTruthy();
    ['Orquestador', 'Develop', 'Testing'].forEach((agente) => {
      expect(screen.getByRole('heading', { level: 3, name: agente })).toBeTruthy();
    });
  });

  it('[C-12] las cifras son las de los archivos de ronda', () => {
    conProceso([
      feature('Una', [ronda(1, true, 2), ronda(2, false)]),
      feature('Dos', [ronda(1, false)]),
      feature('Tres', []),
    ]);

    expect(screen.getByText('3 features · 3 rondas · 2 fallos corregidos')).toBeTruthy();
  });

  it('[C-12] las cifras usan el singular con una sola unidad', () => {
    conProceso([feature('Una', [ronda(1, true, 1), ronda(2, false)])]);

    expect(screen.getByText('1 feature · 2 rondas · 1 fallo corregido')).toBeTruthy();
  });

  it('[C-12] dibuja la línea de rondas de cada feature, también la que aún no tiene', () => {
    conProceso([feature('Una', [ronda(1, false)]), feature('Dos', [])]);

    expect(screen.getByRole('heading', { level: 3, name: 'Una' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'Dos' })).toBeTruthy();
    expect(screen.getByText('Todavía sin revisar')).toBeTruthy();
  });

  it('[C-12] los enlaces apuntan al repositorio y a la entrada de la aplicación', () => {
    conProceso([feature('Una', [ronda(1, false)])]);

    const destinos = screen.getAllByRole('link').map((enlace) => enlace.getAttribute('href'));

    expect(destinos).toContain(`${URL_REPO}/blob/main/CLAUDE.md`);
    expect(destinos).toContain(`${URL_REPO}/commit/b264d4fa3652df75709525fb2b6999de9bd67a31`);
    expect(screen.getByRole('link', { name: 'Entrar' }).getAttribute('href')).toBe('/login');
  });
});
