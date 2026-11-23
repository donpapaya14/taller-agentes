import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import {
  huecosDeRondas,
  leerProceso,
  type FeatureConRondas,
} from '@/adaptadores/proceso/leer-rondas';

const raiz = resolve(import.meta.dirname, '../..');

type Veredicto = 'PASA' | 'FALLA';

// Lo que impide dar una feature por hecha: rondas con huecos o una última ronda que no pasa.
function problemasDeFeaturesHechas(features: FeatureConRondas[]): string[] {
  return features
    .filter((feature) => feature.estado === 'hecha')
    .flatMap((feature) => {
      const hueco = huecosDeRondas(feature);
      if (hueco !== null) {
        return [hueco];
      }
      const ultima = feature.rondas.at(-1);
      return ultima?.veredicto === 'PASA' ? [] : [`${feature.id} no acaba en una ronda PASA`];
    });
}

function directorioTemporal(prefijo: string): string {
  const directorio = mkdtempSync(join(tmpdir(), prefijo));
  onTestFinished(() => rmSync(directorio, { recursive: true, force: true }));
  return directorio;
}

function escribir(ruta: string, texto: string): void {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, texto);
}

function rondaEnTexto(numero: number, veredicto: Veredicto): string {
  const fallos =
    veredicto === 'FALLA'
      ? [
          {
            directriz: 'D-14',
            archivo: 'src/ejemplo.ts',
            descripcion: 'Un catch vacío se traga el error',
            evidencia: 'src/ejemplo.ts:8 tiene catch {} sin mensaje',
          },
        ]
      : [];
  return JSON.stringify({
    feature: 'f-demo',
    ronda: numero,
    fecha: '2026-11-24',
    commitRevisado: 'c3d4e5f',
    veredicto,
    comandos: [{ comando: 'npm run check:full', resultado: 'OK', resumen: 'todo en verde' }],
    fallos,
    observaciones: '',
  });
}

// Un directorio de proceso con una sola feature, `f-demo`, y las rondas que se indiquen.
function procesoDeUnaFeature(estado: string, rondas: [number, Veredicto][]): string {
  const directorio = directorioTemporal('foso-rondas-');
  const feature = { id: 'f-demo', titulo: 'Demo', resumen: 'Feature de prueba', estado };
  escribir(join(directorio, 'features.json'), JSON.stringify([feature]));
  for (const [numero, veredicto] of rondas) {
    escribir(join(directorio, 'f-demo', `ronda-${numero}.json`), rondaEnTexto(numero, veredicto));
  }
  return directorio;
}

const problemasDe = (estado: string, rondas: [number, Veredicto][]) =>
  problemasDeFeaturesHechas(leerProceso(procesoDeUnaFeature(estado, rondas)));

describe('rondas del proceso', () => {
  it('[P-4] las rondas reales de toda feature hecha no tienen huecos y acaban en PASA', () => {
    const features = leerProceso(resolve(raiz, 'proceso'));

    expect(problemasDeFeaturesHechas(features)).toEqual([]);
  });

  it('[P-4] detecta un hueco', () => {
    const [feature] = leerProceso(
      procesoDeUnaFeature('hecha', [
        [1, 'FALLA'],
        [3, 'PASA'],
      ]),
    );

    expect(huecosDeRondas(feature)).toMatch(/ronda 2\b/);
    expect(problemasDeFeaturesHechas([feature])).toHaveLength(1);
  });

  it('[P-4] una feature hecha cuya última ronda falla no cumple', () => {
    expect(
      problemasDe('hecha', [
        [1, 'PASA'],
        [2, 'FALLA'],
      ]),
    ).toEqual(['f-demo no acaba en una ronda PASA']);
  });

  it('[P-4] una feature hecha sin ninguna ronda no cumple', () => {
    expect(problemasDe('hecha', [])).toEqual(['f-demo no acaba en una ronda PASA']);
  });

  it('[P-4] una feature hecha con las rondas 1 a N seguidas y la última PASA cumple', () => {
    expect(
      problemasDe('hecha', [
        [1, 'FALLA'],
        [2, 'FALLA'],
        [3, 'PASA'],
      ]),
    ).toEqual([]);
  });

  it('[P-4] una feature que no está hecha no se comprueba', () => {
    expect(
      problemasDe('en_curso', [
        [1, 'FALLA'],
        [3, 'FALLA'],
      ]),
    ).toEqual([]);
  });
});

// entrega-check resuelve proceso/features.json respecto a su propia carpeta: se copia a una raíz
// de mentira con las features que se quieran, y se ejecuta allí con los paquetes del repo.
function entregaCheckCon(featuresJson: string) {
  const raizDeMentira = directorioTemporal('foso-entrega-');
  const script = join(raizDeMentira, 'scripts', 'entrega-check.mjs');
  mkdirSync(dirname(script));
  copyFileSync(resolve(raiz, 'scripts/entrega-check.mjs'), script);
  symlinkSync(resolve(raiz, 'node_modules'), join(raizDeMentira, 'node_modules'));
  escribir(join(raizDeMentira, 'proceso', 'features.json'), featuresJson);
  return spawnSync(process.execPath, [script], { encoding: 'utf8' });
}

const featureDeEstado = (id: string, estado: string) => ({ id, titulo: `Título de ${id}`, estado });

describe('scripts/entrega-check.mjs', () => {
  it('[P-8] lista las features que no están hechas y sale con 1', () => {
    const features = [
      featureDeEstado('f-hecha', 'hecha'),
      featureDeEstado('f-pendiente', 'pendiente'),
      featureDeEstado('f-en-curso', 'en_curso'),
    ];

    const resultado = entregaCheckCon(JSON.stringify(features));

    expect(resultado.status).toBe(1);
    expect(resultado.stdout).toContain('f-pendiente');
    expect(resultado.stdout).toContain('f-en-curso');
    expect(resultado.stdout).not.toContain('f-hecha');
  });

  it('[P-8] sale con 0 cuando todas las features están hechas', () => {
    const features = [featureDeEstado('f-uno', 'hecha'), featureDeEstado('f-dos', 'hecha')];

    const resultado = entregaCheckCon(JSON.stringify(features));

    expect(resultado.status).toBe(0);
    expect(resultado.stderr).toBe('');
  });

  it.each([
    ['un archivo que no es JSON', 'esto no es JSON'],
    ['algo que no es una lista', '{ "id": "f-uno" }'],
    ['una feature sin estado', '[{ "id": "f-uno", "titulo": "Uno" }]'],
  ])('[P-8][D-2] no da por buena la entrega con %s: explica el error y sale con 1', (_, texto) => {
    const resultado = entregaCheckCon(texto);

    expect(resultado.status).toBe(1);
    expect(resultado.stderr).toContain('No se puede comprobar');
  });
});
