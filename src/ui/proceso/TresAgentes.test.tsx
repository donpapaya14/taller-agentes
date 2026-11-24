import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TresAgentes } from './TresAgentes';

afterEach(cleanup);

const URL_REPO = 'https://github.com/donpapaya14/taller-agentes';

const bloque = (nombre: string) => {
  const titulo = screen.getByRole('heading', { name: nombre });
  const contenedor = titulo.closest('article');
  if (!contenedor) throw new Error(`El agente ${nombre} no está dentro de un bloque`);
  return within(contenedor);
};

describe('TresAgentes', () => {
  it('[C-12] enseña tres bloques: Orquestador, Develop y Testing', () => {
    render(<TresAgentes urlRepo={URL_REPO} />);

    const nombres = screen
      .getAllByRole('heading', { level: 3 })
      .map((titulo) => titulo.textContent);

    expect(nombres).toEqual(['Orquestador', 'Develop', 'Testing']);
  });

  it('[C-12] cada bloque enlaza a su archivo del repositorio', () => {
    render(<TresAgentes urlRepo={URL_REPO} />);

    const destino = (agente: string, archivo: string) =>
      bloque(agente).getByRole('link', { name: archivo }).getAttribute('href');

    expect(destino('Orquestador', 'CLAUDE.md')).toBe(`${URL_REPO}/blob/main/CLAUDE.md`);
    expect(destino('Develop', '.claude/agents/develop.md')).toBe(
      `${URL_REPO}/blob/main/.claude/agents/develop.md`,
    );
    expect(destino('Testing', '.claude/agents/testing.md')).toBe(
      `${URL_REPO}/blob/main/.claude/agents/testing.md`,
    );
    expect(destino('Testing', 'DIRECTRICES.md')).toBe(`${URL_REPO}/blob/main/DIRECTRICES.md`);
  });

  it('[C-12] cada bloque dice en una sola frase qué hace', () => {
    const { container } = render(<TresAgentes urlRepo={URL_REPO} />);

    const parrafos = [...container.querySelectorAll('article')].map((agente) =>
      [...agente.querySelectorAll('p')].map((parrafo) => parrafo.textContent ?? ''),
    );

    expect(parrafos.map((delAgente) => delAgente.length)).toEqual([1, 1, 1]);
    // Una frase acaba en el único punto que lleva.
    expect(parrafos.flat().filter((frase) => !/^[^.]{20,}\.$/.test(frase))).toEqual([]);
  });

  it('[D-13] los nombres de archivo largos se parten en vez de ensanchar el bloque', () => {
    render(<TresAgentes urlRepo={URL_REPO} />);

    const enlace = bloque('Develop').getByRole('link', { name: '.claude/agents/develop.md' });

    expect([...enlace.classList]).toContain('wrap-anywhere');
  });
});
