import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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

  // Sustituye al test provisional del paso 1 (SPEC, Decisiones): aquí solo se fija el texto del
  // enunciado en la portada. Cómo se pinta y a quién redirige lo prueba src/app/page.test.tsx.
  it('la portada presenta FOSO con la frase del enunciado y enlaza a /login y /proceso', () => {
    const portada = readFileSync(ruta('src/app/page.tsx'), 'utf8');

    expect(portada).toContain(
      'Gestión de taller: órdenes, recambios y facturas. La construyeron tres agentes.',
    );
    expect(portada).toContain('href="/login"');
    expect(portada).toContain('href="/proceso"');
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
