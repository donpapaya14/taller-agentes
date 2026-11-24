import { main } from '../../scripts/checklist-entrega.mjs';

export const REPO = 'donpapaya14/taller-agentes';
export const URL_BASE = 'https://foso-taller.vercel.app';
export const CONTRASENA = 'clave-de-prueba';
const ARCHIVOS_DE_LOS_AGENTES = [
  'CLAUDE.md',
  '.claude/agents/develop.md',
  '.claude/agents/testing.md',
  'DIRECTRICES.md',
];

// Los requisitos tal como los nombra la tabla «Cumplimiento del enunciado» del SPEC.
export const R = {
  next: 'Proyecto en Next.js',
  claude: 'Hecho con Claude Code',
  orquestador: 'Orquestador con `CLAUDE.md` que reparte el trabajo',
  develop: 'Subagente Develop con su propio `.md` de cómo programar',
  testing: 'Subagente Testing con `.md` de DIRECTRICES que Develop debe cumplir',
  rondas: 'Testing revisa y devuelve los fallos hasta que todo pasa',
  supabase: 'Base de datos gratuita: Supabase',
  vercel: 'Publicada gratis en Vercel',
  publica: 'Dirección de producción pública, sin protección de Vercel',
  coste: 'Sin gastar dinero',
  claves: 'Ninguna clave de API en el repo',
  repo: 'Repo de GitHub accesible, con los `.md` de los agentes',
  usuario: 'Usuario y contraseña de prueba',
  preguntas: 'Respuestas a 4 preguntas cortas',
  video: 'No hace falta vídeo',
};

export type Resultado = { codigo: number; salida: string };
type Respuesta = { estado: number; cuerpo: string };
export type Mundo = {
  archivos: Record<string, string>;
  comandos: Record<string, Resultado>;
  paginas: Record<string, Respuesta | Error>;
};
type Entorno = Record<string, string | undefined>;
type Fila = { requisito: string; estado: string; detalle: string };

const linea = (...partes: string[]) => partes.join(' ');
export const rawDe = (archivo: string) =>
  `https://raw.githubusercontent.com/${REPO}/main/${archivo}`;

// Las líneas de comando que el checklist lanza, tal como las recibe el sistema falso.
export const COMANDOS = {
  gitLog: linea('git', 'log', '--format=%b'),
  entregaCheck: linea(process.execPath, 'scripts/entrega-check.mjs'),
  ghRepoView: linea('gh', 'repo', 'view', REPO, '--json', 'visibility'),
  gitleaks: linea('gitleaks', 'git', '--no-banner'),
  smoke: linea('npm', 'run', 'smoke'),
};

const EN_VERDE: Resultado = { codigo: 0, salida: '' };

// Todo lo que el checklist le pide al sistema, contestado «en verde». Cada prueba cambia lo suyo.
export function mundoEnVerde(): Mundo {
  const paquete = { dependencies: { next: '16.4.6' }, devDependencies: { vitest: '4.1.11' } };
  return {
    archivos: {
      'package.json': JSON.stringify(paquete),
      'README.md': `| jefe@tallerdemo.example | jefe | Talleres Vega | \`${CONTRASENA}\` |`,
      ...Object.fromEntries(ARCHIVOS_DE_LOS_AGENTES.map((archivo) => [archivo, '# agente'])),
    },
    comandos: {
      [COMANDOS.gitLog]: {
        codigo: 0,
        salida: 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n',
      },
      [COMANDOS.entregaCheck]: { codigo: 0, salida: 'Todas las features están hechas (12).\n' },
      [COMANDOS.ghRepoView]: { codigo: 0, salida: '{"visibility":"PUBLIC"}\n' },
      [COMANDOS.gitleaks]: EN_VERDE,
      [COMANDOS.smoke]: EN_VERDE,
    },
    paginas: {
      [`${URL_BASE}/proceso`]: { estado: 200, cuerpo: '<h1>Proceso</h1>' },
      [`${URL_BASE}/login`]: { estado: 200, cuerpo: '<h1>FOSO</h1>' },
      ...Object.fromEntries(
        ARCHIVOS_DE_LOS_AGENTES.map((archivo) => [rawDe(archivo), { estado: 200, cuerpo: '#' }]),
      ),
    },
  };
}

function sistemaDe(mundo: Mundo, llamadas: string[]) {
  return {
    existe: (ruta: string) => ruta in mundo.archivos,
    leer: (ruta: string) => {
      if (!(ruta in mundo.archivos)) throw new Error(`No existe ${ruta}`);
      return mundo.archivos[ruta];
    },
    ejecutar: (comando: string, argumentos: string[]) => {
      llamadas.push(linea(comando, ...argumentos));
      const previsto = mundo.comandos[linea(comando, ...argumentos)];
      return previsto ?? { codigo: 127, salida: `no existe el comando ${comando}` };
    },
    pedir: async (url: string) => {
      llamadas.push(`GET ${url}`);
      const respuesta = mundo.paginas[url] ?? { estado: 404, cuerpo: 'no encontrada' };
      if (respuesta instanceof Error) throw respuesta;
      return respuesta;
    },
  };
}

// Las filas de la tabla que imprime el checklist, sin la cabecera.
function filasDe(salida: string): Fila[] {
  return salida
    .split('\n')
    .filter((texto) => texto.startsWith('|'))
    .slice(2)
    .map((texto) => {
      const [requisito, estado, detalle] = texto.split(/(?<!\\)\|/).slice(1, 4);
      return { requisito: requisito.trim(), estado: estado.trim(), detalle: detalle.trim() };
    });
}

export const ENTORNO_COMPLETO: Entorno = { URL_BASE, REPO, DEMO_PASSWORD: CONTRASENA };

// Lanza el checklist entero contra un mundo falso y recoge lo que imprime y qué le pidió al sistema.
export async function correr(mundo: Mundo, entorno: Entorno = ENTORNO_COMPLETO) {
  let salida = '';
  let errores = '';
  const llamadas: string[] = [];
  const codigo = await main(entorno, {
    sistema: sistemaDe(mundo, llamadas),
    out: (texto: string) => (salida += texto),
    err: (texto: string) => (errores += texto),
  });
  return { codigo, salida, errores, llamadas, filas: filasDe(salida) };
}

export const filaDe = (filas: Fila[], requisito: string) =>
  filas.find((fila) => fila.requisito === requisito);

// Lo que se estropea de un mundo en verde para que falle una sola comprobación.
export type Cambio = (mundo: Mundo) => void;

export const sinArchivo =
  (ruta: string): Cambio =>
  (mundo) => {
    delete mundo.archivos[ruta];
  };

export const conArchivo =
  (ruta: string, texto: string): Cambio =>
  (mundo) => {
    mundo.archivos[ruta] = texto;
  };

export const sinComando =
  (comando: string): Cambio =>
  (mundo) => {
    delete mundo.comandos[comando];
  };

export const conComando =
  (comando: string, resultado: Resultado): Cambio =>
  (mundo) => {
    mundo.comandos[comando] = resultado;
  };

export const conPagina =
  (url: string, respuesta: Respuesta | Error): Cambio =>
  (mundo) => {
    mundo.paginas[url] = respuesta;
  };
