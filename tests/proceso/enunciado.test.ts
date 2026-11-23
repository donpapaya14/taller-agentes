import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Inicio from '@/app/page';

const raiz = resolve(import.meta.dirname, '../..');

const ruta = (relativa: string) => resolve(raiz, relativa);

describe('enunciado', () => {
  it('[P-9] el proyecto es Next.js con App Router', () => {
    const { dependencies } = JSON.parse(readFileSync(ruta('package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };

    expect(dependencies).toHaveProperty('next');
    expect(existsSync(ruta('src/app/layout.tsx'))).toBe(true);
  });

  it('la portada provisional muestra el nombre FOSO', () => {
    expect(renderToStaticMarkup(createElement(Inicio))).toBe('<main>FOSO</main>');
  });

  // El paso 2 crea .claude/agents; hasta entonces no hay estructura que comprobar.
  it.runIf(existsSync(ruta('.claude/agents')))(
    '[P-9] lleva la estructura de agentes de Claude Code',
    () => {
      expect(existsSync(ruta('.claude/agents/develop.md'))).toBe(true);
      expect(existsSync(ruta('.claude/agents/testing.md'))).toBe(true);
      expect(existsSync(ruta('CLAUDE.md'))).toBe(true);
    },
  );
});
