import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const APP = resolve(import.meta.dirname, '../../src/app');
const SEGMENTO_PRIVADO = '(taller)';
const ESTADOS = ['loading.tsx', 'error.tsx'] as const;

// Las páginas de todo el segmento privado, con la ruta desde su carpeta: «tablero/page.tsx».
function paginasPrivadas(app: string): string[] {
  const privado = join(app, SEGMENTO_PRIVADO);
  if (!existsSync(privado)) return [];

  return readdirSync(privado, { recursive: true, encoding: 'utf8' }).filter(
    (ruta) => ruta === 'page.tsx' || ruta.endsWith('/page.tsx'),
  );
}

// Un estado vale si está junto a la página o en cualquier segmento padre, sin salir de (taller).
function tieneEstado(app: string, pagina: string, estado: (typeof ESTADOS)[number]): boolean {
  const privado = join(app, SEGMENTO_PRIVADO);
  for (let carpeta = dirname(pagina); ; carpeta = dirname(carpeta)) {
    if (existsSync(join(privado, carpeta, estado))) return true;
    if (carpeta === '.') return false;
  }
}

/** «ruta: falta loading.tsx» por cada pantalla privada a la que le falte uno de los dos estados. */
function pantallasSinEstado(app: string): string[] {
  return paginasPrivadas(app).flatMap((pagina) =>
    ESTADOS.filter((estado) => !tieneEstado(app, pagina, estado)).map(
      (estado) => `${SEGMENTO_PRIVADO}/${pagina}: falta ${estado}`,
    ),
  );
}

const temporales: string[] = [];

// Un árbol de src/app de mentira: cada ruta es un archivo vacío.
function arbol(...archivos: string[]): string {
  const app = mkdtempSync(join(tmpdir(), 'estados-'));
  temporales.push(app);
  archivos.forEach((archivo) => {
    mkdirSync(dirname(join(app, archivo)), { recursive: true });
    writeFileSync(join(app, archivo), '');
  });
  return app;
}

afterEach(() => {
  temporales.splice(0).forEach((app) => rmSync(app, { recursive: true, force: true }));
});

describe('estados de las pantallas privadas', () => {
  it('[C-15][D-11] el segmento (taller) tiene su pantalla de carga y su pantalla de error', () => {
    const faltan = ESTADOS.filter((estado) => !existsSync(join(APP, SEGMENTO_PRIVADO, estado)));

    expect(faltan).toEqual([]);
  });

  it('[C-15][D-11] cada pantalla privada tiene carga y error', () => {
    expect(pantallasSinEstado(APP)).toEqual([]);
  });

  it('[C-15][D-11] la comprobación señala la pantalla que no tiene ninguno de los dos', () => {
    const app = arbol('(taller)/tablero/page.tsx');

    expect(pantallasSinEstado(app)).toEqual([
      '(taller)/tablero/page.tsx: falta loading.tsx',
      '(taller)/tablero/page.tsx: falta error.tsx',
    ]);
  });

  it('[C-15][D-11] vale un estado junto a la página o en un segmento padre dentro de (taller)', () => {
    const app = arbol(
      '(taller)/loading.tsx',
      '(taller)/error.tsx',
      '(taller)/tablero/page.tsx',
      '(taller)/ordenes/error.tsx',
      '(taller)/ordenes/[id]/page.tsx',
      '(taller)/recambios/page.tsx',
      '(taller)/recambios/loading.tsx',
    );

    expect(pantallasSinEstado(app)).toEqual([]);
  });

  it('[C-15][D-11] un estado fuera de (taller) no cuenta para sus pantallas', () => {
    const app = arbol('loading.tsx', 'error.tsx', '(taller)/tablero/page.tsx');

    expect(pantallasSinEstado(app)).toHaveLength(2);
  });

  it('[C-15][D-11] una página que no está en (taller) no se pide', () => {
    expect(pantallasSinEstado(arbol('proceso/page.tsx', 'login/page.tsx', 'page.tsx'))).toEqual([]);
  });
});
