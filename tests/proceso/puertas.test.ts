import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = resolve(import.meta.dirname, '../..');

const leerJson = <T>(archivo: string): T =>
  JSON.parse(readFileSync(resolve(raiz, archivo), 'utf8')) as T;

const leerTexto = (archivo: string) => readFileSync(resolve(raiz, archivo), 'utf8');

const GATE = '.github/workflows/gate.yml';

const lineasDe = (archivo: string) => leerTexto(archivo).split('\n');

// Cada `uses:` de un workflow: la acción, su referencia y el comentario con la versión.
const usosDeAcciones = (workflow: string[]) =>
  workflow
    .map((linea) => linea.trim().replace(/^- /, ''))
    .filter((linea) => linea.startsWith('uses: '))
    .map((linea) => {
      const [uso, version = ''] = linea.slice('uses: '.length).split(' # ');
      const [accion, referencia = ''] = uso.split('@');
      return { accion, referencia, version };
    });

// La imagen de cada `docker pull` y `docker run` del workflow.
const imagenesDeDocker = (workflow: string) =>
  [...workflow.matchAll(/docker (?:pull -q|run --rm -v "[^"]*") (\S+)/g)].map(
    ([, imagen]) => imagen,
  );

const SCRIPTS_DE_LAS_PUERTAS = [
  'check',
  'check:full',
  'cobertura',
  'arquitectura',
  'duplicado',
  'muerto',
  'spec:check',
  'gate:tipos',
  'gate:rls',
  'gate:mutacion',
  'gate:e2e',
  'smoke',
  'checklist',
];

const MINIMO_CARACTERES_DEL_MOTIVO = 20;

describe('puertas de calidad', () => {
  it('[P-1] package.json define los scripts de las puertas', () => {
    const { scripts } = leerJson<{ scripts: Record<string, string> }>('package.json');

    const ausentes = SCRIPTS_DE_LAS_PUERTAS.filter(
      (nombre) => typeof scripts[nombre] !== 'string' || scripts[nombre].trim() === '',
    );

    expect(ausentes).toEqual([]);
  });

  it('[P-1] calidad.json declara tipo web, supabase y las omisiones con motivo', () => {
    const { tipo, supabase, omitir } = leerJson<{
      tipo: string;
      supabase: boolean;
      omitir: Record<string, string>;
    }>('calidad.json');

    expect(tipo).toBe('web');
    expect(supabase).toBe(true);
    expect(Object.keys(omitir)).not.toHaveLength(0);
    const sinMotivo = Object.entries(omitir).filter(
      ([, motivo]) => motivo.length <= MINIMO_CARACTERES_DEL_MOTIVO,
    );
    expect(sinMotivo).toEqual([]);
  });

  it('[P-3] check:full termina en spec:check, que cruza el SPEC y las directrices con los tests', () => {
    const { scripts } = leerJson<{ scripts: Record<string, string> }>('package.json');

    expect(scripts['check:full']).toMatch(/&& npm run spec:check$/);
    expect(scripts['spec:check']).toContain('--specs docs/SPEC.md,DIRECTRICES.md');
    expect(scripts['spec:check']).toContain('--vitest reports/vitest.json');
    expect(scripts['spec:check']).not.toContain('--no-escribir');
  });

  it('[P-1] el job desplegar instala el navegador antes del smoke de producción', () => {
    const gate = readFileSync(resolve(raiz, '.github/workflows/gate.yml'), 'utf8');
    const inicioDelJob = gate.indexOf('\n  desplegar:');
    expect(inicioDelJob).toBeGreaterThan(-1);
    const desplegar = gate.slice(inicioDelJob);

    const instalacion = desplegar.indexOf('npx playwright install --with-deps chromium');
    const smoke = desplegar.indexOf('npm run smoke');

    expect(instalacion).toBeGreaterThan(-1);
    expect(smoke).toBeGreaterThan(instalacion);
  });
});

describe('gate de GitHub', () => {
  it('[P-1] el gate fija cada acción por el SHA de su commit y anota la versión en un comentario', () => {
    const gate = lineasDe(GATE);
    const usos = usosDeAcciones(gate);
    const lineasConUses = gate.filter(
      (linea) => linea.includes('uses:') && !linea.trimStart().startsWith('#'),
    );

    expect(usos.length).toBeGreaterThan(0);
    expect(usos).toHaveLength(lineasConUses.length);
    expect(usos.filter(({ referencia }) => !/^[0-9a-f]{40}$/.test(referencia))).toEqual([]);
    expect(usos.filter(({ version }) => !/^v\d+\.\d+\.\d+$/.test(version))).toEqual([]);
  });

  it('[P-1] el gate usa imágenes con versión fija, ninguna con latest ni sin etiqueta', () => {
    const imagenes = imagenesDeDocker(leerTexto(GATE));

    expect(imagenes.length).toBeGreaterThan(0);
    expect(imagenes.filter((imagen) => !/^[\w./-]+:v?\d+\.\d+\.\d+$/.test(imagen))).toEqual([]);
    // Las que se descargan son las mismas que se ejecutan: tres imágenes, cada una dos veces.
    expect(new Set(imagenes).size).toBe(3);
  });

  it('[P-1] el smoke de producción recibe la contraseña de la demo en su propio paso', () => {
    const gate = lineasDe(GATE).map((linea) => linea.trim());
    const paso = gate.slice(gate.indexOf('- name: Smoke de producción'));

    expect(paso.slice(0, 4)).toEqual([
      '- name: Smoke de producción',
      'env:',
      'DEMO_PASSWORD: ${{ secrets.DEMO_PASSWORD }}',
      'run: npm run smoke',
    ]);
  });

  it('[P-1] dependabot espera siete días antes de proponer una versión nueva, en los dos ecosistemas', () => {
    const lineas = lineasDe('.github/dependabot.yml').map((linea) => linea.trim());
    const esperas = lineas.filter(
      (linea, i) => linea === 'cooldown:' && lineas[i + 1] === 'default-days: 7',
    );

    expect(lineas.filter((linea) => linea.startsWith('- package-ecosystem:'))).toHaveLength(2);
    expect(esperas).toHaveLength(2);
  });
});
