import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { USUARIOS_DEMO } from '@/aplicacion/acceso';

const raiz = resolve(import.meta.dirname, '../..');

// Los títulos de la entrega, en su orden. Ni uno más: lo que no cabe aquí va dentro de una sección.
const TITULOS_DEL_README = [
  'FOSO',
  'Probarla',
  'Los tres agentes',
  'Dónde están las rondas',
  'Directrices con test',
  'Stack',
  'Arquitectura',
  'Arrancar en local',
  'Qué no hace',
  'Las cuatro preguntas',
];

const MAXIMO_DE_LINEAS_DEL_README = 130;
const CAPTURA_DEL_TABLERO = 'docs/diseno/tablero-escritorio.png';
const DIRECCION_DE_PRODUCCION = 'https://foso-taller.vercel.app';

const leer = (relativa: string) => readFileSync(resolve(raiz, relativa), 'utf8');

type Seccion = { titulo: string; texto: string };

// Las secciones de un markdown. Lo que va dentro de un bloque de código no abre sección: la línea
// «# comentario» de un script no es un título.
function seccionesDe(markdown: string): Seccion[] {
  const secciones: { titulo: string; lineas: string[] }[] = [];
  let dentroDeCodigo = false;
  for (const linea of markdown.split('\n')) {
    if (linea.startsWith('```')) dentroDeCodigo = !dentroDeCodigo;
    const titulo = dentroDeCodigo ? undefined : linea.match(/^#{1,6} (.+)$/)?.[1].trim();
    if (titulo) secciones.push({ titulo, lineas: [] });
    else secciones.at(-1)?.lineas.push(linea);
  }
  return secciones.map(({ titulo, lineas }) => ({ titulo, texto: lineas.join('\n') }));
}

const seccionDe = (markdown: string, titulo: RegExp | string) =>
  seccionesDe(markdown).find((seccion) =>
    typeof titulo === 'string' ? seccion.titulo === titulo : titulo.test(seccion.titulo),
  );

// Los números de las líneas numeradas («1. …»), en el orden en que aparecen.
const numerosDeLista = (texto: string) =>
  [...texto.matchAll(/^ *(\d+)\. +\S/gm)].map(([, numero]) => Number(numero));

// Los destinos de los enlaces e imágenes de markdown que apuntan a un archivo del repo.
const rutasLocalesDe = (markdown: string) =>
  [...markdown.matchAll(/\]\(([^)\s]+)\)/g)]
    .map(([, destino]) => destino.split('#')[0])
    .filter((destino) => destino !== '' && !/^[a-z]+:/i.test(destino));

describe('README', () => {
  const readme = leer('README.md');

  it('[P-6] el README tiene las secciones de la entrega', () => {
    const probarla = seccionDe(readme, 'Probarla')?.texto ?? '';

    expect(seccionesDe(readme).map(({ titulo }) => titulo)).toEqual(TITULOS_DEL_README);
    expect(probarla).toMatch(/https:\/\/\S+/);
    for (const correo of Object.values(USUARIOS_DEMO)) expect(probarla).toContain(correo);
    expect(readme.trimEnd().split('\n').length).toBeLessThanOrEqual(MAXIMO_DE_LINEAS_DEL_README);
  });

  it('[P-6] el README avisa de que los datos son ficticios y de que las puertas son reutilizadas', () => {
    expect(readme).toMatch(/datos ficticios/i);
    expect(readme).toContain('scripts/puertas');
  });

  it('[P-6] los enlaces y la captura del README apuntan a archivos que existen', () => {
    const rutas = rutasLocalesDe(readme);

    expect(rutas).toContain(CAPTURA_DEL_TABLERO);
    expect(rutas.filter((ruta) => !existsSync(resolve(raiz, ruta)))).toEqual([]);
  });
});

describe('README: lo que cuenta con honestidad', () => {
  const readme = leer('README.md');

  // El script lee `process.env` y nada más: sin cargar `.env.local` falla por una variable que falta.
  it('[P-6] el comando que crea los usuarios carga el entorno', () => {
    const arrancar = seccionDe(readme, 'Arrancar en local')?.texto ?? '';

    expect(arrancar).toContain('node --env-file=.env.local scripts/crear-usuarios-demo.mjs');
  });

  // El hook de commit viene en el repo pero no se activa solo: quien clone tiene que saber cómo.
  it('[P-6] dice cómo activar el hook de commit', () => {
    const arrancar = seccionDe(readme, 'Arrancar en local')?.texto ?? '';

    expect(arrancar).toContain('git config core.hooksPath .githooks');
  });

  it('[P-6] dice cómo se lanzaron Develop y Testing', () => {
    const agentes = seccionDe(readme, 'Los tres agentes')?.texto ?? '';

    expect(agentes).toContain('subagentes de Claude Code a los que se les dijo que leyeran');
    expect(agentes).toContain('`.claude/agents/develop.md` o `.claude/agents/testing.md`');
  });

  it('[P-6] avisa de que restablecer la demo es público y de que los listados no se paginan', () => {
    const limites = seccionDe(readme, 'Qué no hace')?.texto ?? '';

    expect(limites).toContain('«Restablecer la demo» es público');
    expect(limites).toContain('los listados no se paginan');
  });

  it('[P-6] distingue los fallos que relanza de los que cuenta sin registrar', () => {
    const limites = seccionDe(readme, 'Qué no hace')?.texto ?? '';

    expect(limites).toContain('los relanzan y los registra Vercel');
    expect(limites).toContain('capturan cualquier fallo');
  });
});

describe('entrega', () => {
  it.each(['README.md', 'docs/ENTREGA.md'])('[P-6] %s reserva las cuatro preguntas', (archivo) => {
    const preguntas = seccionDe(leer(archivo), /cuatro preguntas/i);

    expect(preguntas).toBeDefined();
    expect(numerosDeLista(preguntas?.texto ?? '')).toEqual([1, 2, 3, 4]);
  });

  // La dirección de producción es una sola, y es la misma en lo que se lee y en lo que se envía.
  it.each(['README.md', 'docs/ENTREGA.md'])(
    '[P-6] %s da la dirección de producción definitiva y ninguna otra',
    (archivo) => {
      expect(leer(archivo).match(/https:\/\/[\w-]+\.vercel\.app/g)).toEqual([
        DIRECCION_DE_PRODUCCION,
      ]);
    },
  );

  it('[P-6] el README deja las cuatro preguntas como pendientes', () => {
    const preguntas = seccionDe(leer('README.md'), 'Las cuatro preguntas')?.texto ?? '';

    expect(preguntas.match(/Pendiente: se contestan al recibirlas/g)).toHaveLength(4);
  });

  it('[P-6] la plantilla de entrega trae el enlace, el repositorio y los tres usuarios', () => {
    const entrega = leer('docs/ENTREGA.md');

    expect(entrega).toMatch(/https:\/\/\S+/);
    expect(entrega).toContain('github.com/donpapaya14/taller-agentes');
    for (const correo of Object.values(USUARIOS_DEMO)) expect(entrega).toContain(correo);
  });
});
