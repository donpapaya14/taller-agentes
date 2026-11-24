import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '../../src');

// Con el tema por defecto apagado (--*: initial) solo existen los puntos de ruptura que declara
// tokens.css. Una clase como sm:grid-cols-2 no da error ni genera CSS: la regla simplemente no
// existe y el diseño que se creía responsivo no cambia en ninguna pantalla.
const PUNTOS_DE_TAILWIND = ['sm', 'md', 'lg', 'xl', '2xl'];

const declaradosEn = (tokens: string) =>
  [...tokens.matchAll(/--breakpoint-(\w+)\s*:/g)].map(([, nombre]) => nombre);

/** Cada clase que usa un punto de ruptura de Tailwind que el tema no declara. */
function clasesMuertas(texto: string, declarados: string[]): string[] {
  const sinDeclarar = PUNTOS_DE_TAILWIND.filter((punto) => !declarados.includes(punto));
  const variante = new RegExp(`(?<![\\w-])(?:${sinDeclarar.join('|')}):[\\w@[-]+`, 'g');
  return texto.match(variante) ?? [];
}

const interfaz = () =>
  readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter(
    (ruta) => /\.(?:tsx|css)$/.test(ruta) && !ruta.endsWith('.test.tsx'),
  );

describe('puntos de ruptura del tema', () => {
  it('[C-14][D-9] los tokens declaran lg y xl, y ningún otro', () => {
    const tokens = readFileSync(join(SRC, 'ui', 'tokens.css'), 'utf8');

    expect(declaradosEn(tokens)).toEqual(['lg', 'xl']);
  });

  it('[C-14][D-9] ninguna clase de la interfaz usa un punto de ruptura que el tema no declara', () => {
    const declarados = declaradosEn(readFileSync(join(SRC, 'ui', 'tokens.css'), 'utf8'));

    const muertas = interfaz().flatMap((ruta) =>
      clasesMuertas(readFileSync(join(SRC, ruta), 'utf8'), declarados).map(
        (clase) => `${ruta}: ${clase}`,
      ),
    );

    expect(muertas).toEqual([]);
  });

  it('[C-14][D-9] la comprobación señala una clase muerta y deja pasar las declaradas', () => {
    const texto = '<dl className="grid gap-e4 sm:grid-cols-2 lg:grid-cols-2 xl:px-e5 md:hidden">';

    expect(clasesMuertas(texto, ['lg', 'xl'])).toEqual(['sm:grid-cols-2', 'md:hidden']);
    expect(clasesMuertas(texto, ['sm', 'md', 'lg', 'xl'])).toEqual([]);
  });
});
