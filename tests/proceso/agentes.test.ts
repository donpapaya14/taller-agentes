import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = resolve(import.meta.dirname, '../..');

const AGENTES = {
  develop: '.claude/agents/develop.md',
  testing: '.claude/agents/testing.md',
};
const LOS_CUATRO_ARCHIVOS = ['CLAUDE.md', AGENTES.develop, AGENTES.testing, 'DIRECTRICES.md'];

// Lo que haría depender a un agente de algo que no está en el repo: la carpeta personal,
// una ruta absoluta de la máquina o las skills de quien lo escribió.
const DEPENDENCIAS_DE_FUERA = [/~\//, /\/Users\//, /skill/i];

const leer = (archivo: string) => readFileSync(resolve(raiz, archivo), 'utf8');

// La cabecera de un agente de Claude Code: líneas `clave: valor` entre dos líneas `---`.
function cabeceraDe(texto: string): Map<string, string> {
  const lineas = texto.split('\n');
  const cierre = lineas.indexOf('---', 1);
  if (lineas[0] !== '---' || cierre === -1) {
    return new Map();
  }
  const pares = lineas.slice(1, cierre).map((linea): [string, string] => {
    const separador = linea.indexOf(':');
    return [linea.slice(0, separador).trim(), linea.slice(separador + 1).trim()];
  });
  return new Map(pares);
}

const herramientasDe = (cabecera: Map<string, string>) =>
  (cabecera.get('tools') ?? '').split(',').map((herramienta) => herramienta.trim());

describe('agentes del repo', () => {
  it('[P-2] existen los cuatro archivos de los agentes y no están vacíos', () => {
    const faltan = LOS_CUATRO_ARCHIVOS.filter(
      (archivo) => !existsSync(resolve(raiz, archivo)) || leer(archivo).trim() === '',
    );

    expect(faltan).toEqual([]);
  });

  it('[P-2] develop y testing declaran name, description, tools y model', () => {
    for (const [nombre, archivo] of Object.entries(AGENTES)) {
      const cabecera = cabeceraDe(leer(archivo));

      expect(cabecera.get('name'), `name de ${archivo}`).toBe(nombre);
      expect(cabecera.get('description'), `description de ${archivo}`).toBeTruthy();
      expect(cabecera.get('tools'), `tools de ${archivo}`).toBeTruthy();
      expect(cabecera.get('model'), `model de ${archivo}`).toBe('sonnet');
    }
    expect(herramientasDe(cabeceraDe(leer(AGENTES.testing)))).not.toContain('Edit');
  });

  it('[P-2] el orquestador nombra a los dos subagentes y describe las rondas', () => {
    const orquestador = leer('CLAUDE.md');

    expect(orquestador).toContain('develop');
    expect(orquestador).toContain('testing');
    expect(orquestador).toContain('ronda');
  });

  it('[P-2] develop remite a las directrices', () => {
    expect(leer(AGENTES.develop)).toContain('DIRECTRICES.md');
  });

  it('[P-2] los agentes no dependen de nada de fuera del repo', () => {
    const dependencias = LOS_CUATRO_ARCHIVOS.flatMap((archivo) =>
      DEPENDENCIAS_DE_FUERA.filter((patron) => patron.test(leer(archivo))).map(
        (patron) => `${archivo} contiene ${patron}`,
      ),
    );

    expect(dependencias).toEqual([]);
  });
});
