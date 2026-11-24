import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COMANDOS,
  R,
  correr,
  filaDe,
  mundoEnVerde,
  type Mundo,
  type Resultado,
} from '../apoyo/checklist-falso';

const raiz = resolve(import.meta.dirname, '../..');

// Los requisitos de la tabla «Cumplimiento del enunciado» del SPEC: de ahí salen las filas.
function requisitosDelSpec(): string[] {
  const spec = readFileSync(resolve(raiz, 'docs/SPEC.md'), 'utf8');
  const seccion = spec.split('\n## Cumplimiento del enunciado')[1]?.split('\n## ')[0] ?? '';
  return seccion
    .split('\n')
    .filter((texto) => texto.startsWith('|'))
    .slice(2)
    .map((texto) => texto.split('|')[1].trim());
}

describe('checklist de entrega: la tabla', () => {
  it('tiene una fila por requisito del enunciado, en el orden del SPEC', async () => {
    const { filas } = await correr(mundoEnVerde());

    expect(requisitosDelSpec()).toHaveLength(Object.keys(R).length);
    expect(filas.map(({ requisito }) => requisito)).toEqual(requisitosDelSpec());
  });

  it('con todo en verde no hay FALLO, sale con 0 y deja a mano lo que no se puede ver', async () => {
    const { codigo, filas, salida } = await correr(mundoEnVerde());

    const aMano = filas.filter(({ estado }) => estado === 'A MANO');
    expect(filas.filter(({ estado }) => estado === 'FALLO')).toEqual([]);
    expect(codigo).toBe(0);
    expect(aMano.map(({ requisito }) => requisito)).toEqual([
      R.supabase,
      R.vercel,
      R.publica,
      R.coste,
      R.preguntas,
    ]);
    expect(salida).toContain('Resumen: 10 OK, 0 FALLO, 5 A MANO.');
  });

  it('lo que sí se comprueba sale OK con lo que se vio', async () => {
    const { filas } = await correr(mundoEnVerde());

    expect(filaDe(filas, R.next)).toMatchObject({ estado: 'OK' });
    expect(filaDe(filas, R.next)?.detalle).toContain('16.4.6');
    expect(filaDe(filas, R.claude)?.detalle).toContain('1 línea');
    expect(filaDe(filas, R.rondas)?.detalle).toContain('Todas las features están hechas (12).');
    expect(filaDe(filas, R.video)).toMatchObject({ estado: 'OK' });
  });

  it('un detalle con barras o saltos de línea no rompe la tabla', async () => {
    const mundo = mundoEnVerde();
    mundo.comandos[COMANDOS.entregaCheck] = {
      codigo: 1,
      salida: 'Features sin hacer: 1 de 12\n- f12 [pendiente] a | b\n',
    };

    const { filas } = await correr(mundo);

    expect(filas).toHaveLength(Object.keys(R).length);
    expect(filaDe(filas, R.rondas)).toMatchObject({ estado: 'FALLO' });
    expect(filaDe(filas, R.rondas)?.detalle).toContain('f12 [pendiente] a \\| b');
  });
});

type Cambio = (mundo: Mundo) => void;

const sinArchivo =
  (ruta: string): Cambio =>
  (mundo) => {
    delete mundo.archivos[ruta];
  };
const conArchivo =
  (ruta: string, texto: string): Cambio =>
  (mundo) => {
    mundo.archivos[ruta] = texto;
  };
const conComando =
  (comando: string, resultado: Resultado): Cambio =>
  (mundo) => {
    mundo.comandos[comando] = resultado;
  };

const CON_STRIPE = '{"dependencies":{"next":"16.4.6","stripe":"1.0.0"}}';
const CON_OPENAI = '{"dependencies":{"next":"16.4.6"},"devDependencies":{"openai":"1.0.0"}}';
const SIN_NEXT = '{"dependencies":{}}';
const CON_HALLAZGOS = { codigo: 1, salida: 'leaks found: 2' };
const SMOKE_ROJO = { codigo: 1, salida: '1 failed' };
const REPO_PRIVADO = { codigo: 0, salida: '{"visibility":"PRIVATE"}' };
const SIN_COMMITS_DE_CLAUDE = { codigo: 0, salida: 'Corrige un test\n' };
const SIN_FEATURES = { codigo: 1, salida: 'Features sin hacer: 1 de 12\n- f12 [pendiente] Móvil' };

const FALLOS: [string, Cambio, string, string][] = [
  ['package.json sin next', conArchivo('package.json', SIN_NEXT), R.next, 'next'],
  [
    'commits sin Co-Authored-By',
    conComando(COMANDOS.gitLog, SIN_COMMITS_DE_CLAUDE),
    R.claude,
    'Co-Authored-By',
  ],
  ['sin CLAUDE.md', sinArchivo('CLAUDE.md'), R.orquestador, 'CLAUDE.md'],
  ['sin develop.md', sinArchivo('.claude/agents/develop.md'), R.develop, 'develop.md'],
  ['sin testing.md', sinArchivo('.claude/agents/testing.md'), R.testing, 'testing.md'],
  ['sin DIRECTRICES.md', sinArchivo('DIRECTRICES.md'), R.testing, 'DIRECTRICES.md'],
  ['una feature sin hacer', conComando(COMANDOS.entregaCheck, SIN_FEATURES), R.rondas, 'f12'],
  ['stripe en dependencies', conArchivo('package.json', CON_STRIPE), R.coste, 'stripe'],
  ['openai en devDependencies', conArchivo('package.json', CON_OPENAI), R.coste, 'openai'],
  [
    'gitleaks con hallazgos',
    conComando(COMANDOS.gitleaks, CON_HALLAZGOS),
    R.claves,
    'leaks found: 2',
  ],
  ['el repositorio privado', conComando(COMANDOS.ghRepoView, REPO_PRIVADO), R.repo, 'PRIVATE'],
  ['el smoke en rojo', conComando(COMANDOS.smoke, SMOKE_ROJO), R.usuario, '1 failed'],
  [
    'el README sin la contraseña puesta',
    conArchivo('README.md', '{{DEMO_PASSWORD}}'),
    R.usuario,
    '{{DEMO_PASSWORD}}',
  ],
];

describe('checklist de entrega: lo que falla', () => {
  it.each(FALLOS)('FALLO con %s, y solo en su fila', async (_, estropear, requisito, texto) => {
    const mundo = mundoEnVerde();
    estropear(mundo);

    const { codigo, filas } = await correr(mundo);

    expect(codigo).toBe(1);
    expect(filaDe(filas, requisito)).toMatchObject({ estado: 'FALLO' });
    expect(filaDe(filas, requisito)?.detalle).toContain(texto);
    expect(filas.filter(({ estado }) => estado === 'FALLO')).toHaveLength(1);
  });
});
