import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const leer = (ruta: string) => readFileSync(resolve(import.meta.dirname, '../..', ruta), 'utf8');

const TOKENS = leer('src/ui/tokens.css');

// Un icono se carga como imagen suelta: no hereda las variables de la página y no puede escribir
// var(--foso). Lleva los colores copiados, y este test es lo que los ata a tokens.css.
const hexDelToken = (nombre: string) =>
  TOKENS.match(new RegExp(`(?<![\\w-])--${nombre}\\s*:\\s*(#[0-9a-f]{6})\\s*;`, 'i'))?.[1];

describe('icono de la app', () => {
  it('[D-9] es un SVG en el sitio donde Next lo busca para la pestaña del navegador', () => {
    const icono = leer('src/app/icon.svg');

    expect(icono.trimStart().startsWith('<svg ')).toBe(true);
    expect(icono).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(icono).toMatch(/viewBox="0 0 \d+ \d+"/);
  });

  it('[D-9] sus colores son la lámpara sobre el foso de tokens.css, y ningún otro', () => {
    const colores = [...leer('src/app/icon.svg').matchAll(/(?:fill|stroke)="([^"]+)"/g)].map(
      ([, valor]) => valor.toLowerCase(),
    );

    expect(new Set(colores)).toEqual(
      new Set([hexDelToken('foso')?.toLowerCase(), hexDelToken('lampara')?.toLowerCase()]),
    );
  });

  // Un SVG abierto directamente en la pestaña ejecuta sus scripts con el origen de la app.
  it('no lleva scripts, manejadores ni enlaces', () => {
    expect(leer('src/app/icon.svg')).not.toMatch(/<script|\bon[a-z]+=|href=/i);
  });
});
