import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const raiz = resolve(import.meta.dirname, '../..');

const leerJson = <T>(archivo: string): T =>
  JSON.parse(readFileSync(resolve(raiz, archivo), 'utf8')) as T;

const leerTexto = (archivo: string) => readFileSync(resolve(raiz, archivo), 'utf8');

const GATE = '.github/workflows/gate.yml';

const lineasDe = (archivo: string) => leerTexto(archivo).split('\n');

// El texto del job `desplegar`: de su clave al final del archivo.
const trabajoDesplegar = () => {
  const gate = leerTexto(GATE);
  return gate.slice(gate.indexOf('\n  desplegar:'));
};

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

  // La CLI de Vercel lee VERCEL_TOKEN del entorno; un `--token` lo dejaría en la línea de comandos,
  // que el log de Actions y la lista de procesos enseñan.
  it('[P-1] el script desplegar usa la CLI de Vercel con versión fija y sin pasarle el token', () => {
    const { scripts } = leerJson<{ scripts: Record<string, string> }>('package.json');

    const llamadas = scripts.desplegar.split(' && ');

    expect(llamadas).toHaveLength(3);
    expect(
      llamadas.filter(
        (llamada) => !/^npx vercel@\d+\.\d+\.\d+ (?:pull|build|deploy) /.test(llamada),
      ),
    ).toEqual([]);
    expect(scripts.desplegar).not.toContain('--token');
  });
});

describe('job desplegar', () => {
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

  // Sin URL_PRODUCCION el smoke levantaría la app en el runner y daría por buena una producción
  // que nadie ha mirado: el job falla antes de desplegar.
  it('[P-1] el job desplegar falla antes de desplegar si URL_BASE está vacía', () => {
    const desplegar = trabajoDesplegar();

    const comprobacion = desplegar.indexOf('test -n "$URL_BASE"');
    const despliegue = desplegar.indexOf('- name: Desplegar');

    expect(comprobacion).toBeGreaterThan(-1);
    expect(despliegue).toBeGreaterThan(comprobacion);
  });

  it('[P-1] los secretos de Vercel van en el env del paso Desplegar y no en el de todo el job', () => {
    const desplegar = trabajoDesplegar();
    const cabeceraDelJob = desplegar.slice(0, desplegar.indexOf('steps:'));
    const lineas = desplegar.split('\n').map((linea) => linea.trim());
    const paso = lineas.slice(lineas.indexOf('- name: Desplegar'));

    expect(cabeceraDelJob).not.toMatch(/VERCEL_(?:TOKEN|ORG_ID|PROJECT_ID)/);
    expect(paso.slice(0, 6)).toEqual([
      '- name: Desplegar',
      'env:',
      'VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}',
      'VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}',
      'VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}',
      'run: npm run desplegar',
    ]);
    // Los tres, y solo ahí: ningún otro paso del job los lee.
    expect(desplegar.match(/secrets\.VERCEL_/g)).toHaveLength(3);
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

  it('[P-1] el gate fija la versión de la CLI de Supabase que levanta la base local', () => {
    const gate = lineasDe(GATE).map((linea) => linea.trim());
    const paso = gate.slice(
      gate.findIndex((linea) => linea.startsWith('- uses: supabase/setup-cli@')),
    );

    expect(paso.slice(1, 4)).toEqual([
      "if: env.NIVEL == 'completo'",
      'with:',
      expect.stringMatching(/^version: 2\.\d+\.\d+$/),
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

describe('hook de commit', () => {
  const HOOK = resolve(raiz, '.githooks/pre-commit');

  // El hook llama a `npm` por el PATH: con un `npm` falso se ve con qué argumentos lo llama y que
  // sale con su código, sin lanzar la suite entera dentro de la suite.
  function correrConNpmQueSaleCon(codigo: number) {
    const carpeta = mkdtempSync(join(tmpdir(), 'hook-de-commit-'));
    try {
      const argumentos = join(carpeta, 'argumentos');
      const npmFalso = `#!/bin/sh\necho "$@" > "${argumentos}"\nexit ${codigo}\n`;
      writeFileSync(join(carpeta, 'npm'), npmFalso, { mode: 0o755 });

      const { status } = spawnSync(HOOK, {
        env: { ...process.env, PATH: `${carpeta}:${process.env.PATH}` },
      });

      return { salida: status, argumentos: readFileSync(argumentos, 'utf8').trim() };
    } finally {
      rmSync(carpeta, { recursive: true, force: true });
    }
  }

  it('[P-1] el hook de commit va en el repo y es ejecutable', () => {
    expect(statSync(HOOK).mode & 0o100).not.toBe(0);
  });

  it.each([0, 1])('[P-1] el hook corre npm run check y sale con su código (%i)', (codigo) => {
    expect(correrConNpmQueSaleCon(codigo)).toEqual({ salida: codigo, argumentos: 'run check' });
  });
});

describe('configuración de Playwright', () => {
  const APP_LOCAL = 'http://127.0.0.1:3000';

  afterEach(() => vi.unstubAllEnvs());

  // La configuración lee `URL_BASE` al cargarse: cada caso la carga de nuevo con su entorno.
  async function configuracionCon(urlBase: string | undefined) {
    vi.stubEnv('URL_BASE', urlBase);
    vi.resetModules();
    return (await import('../../playwright.config')).default;
  }

  it.each([undefined, ''])(
    '[P-1] con URL_BASE %j prueba la app local y la levanta',
    async (urlBase) => {
      const configuracion = await configuracionCon(urlBase);

      expect(configuracion.use?.baseURL).toBe(APP_LOCAL);
      expect(configuracion.webServer).toMatchObject({ url: APP_LOCAL });
    },
  );

  it('[P-1] con URL_BASE prueba ese despliegue y no levanta nada', async () => {
    const configuracion = await configuracionCon('https://produccion.example');

    expect(configuracion.use?.baseURL).toBe('https://produccion.example');
    expect(configuracion.webServer).toBeUndefined();
  });
});
