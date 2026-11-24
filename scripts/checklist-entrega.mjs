// Recorre «Cumplimiento del enunciado» (docs/SPEC.md) contra el repo y contra producción: una fila
// por requisito con OK, FALLO o A MANO. Lo que un script no puede ver (los planes, la facturación,
// la protección de Vercel, las respuestas) queda como A MANO.
//
// Uso: URL_BASE=https://... DEMO_PASSWORD=... [REPO=propietario/repositorio] npm run checklist
// Sin URL_BASE las comprobaciones de la web salen FALLO; sin REPO se usa donpapaya14/taller-agentes.
// Salida: 0 sin FALLO, 1 con algún FALLO, 2 si el entorno está mal formado.
import { sistemaReal } from './checklist-sistema.mjs';
import { seEjecutaDirectamente } from './puertas/lib/puerta.mjs';

const USO =
  'Uso: URL_BASE=https://... DEMO_PASSWORD=... [REPO=propietario/repositorio] npm run checklist';
const REPO_POR_DEFECTO = 'donpapaya14/taller-agentes';
// El propietario no empieza por «-»: el valor va tal cual a `gh repo view` y a una dirección.
const FORMATO_DE_REPO = /^[A-Za-z0-9][A-Za-z0-9-]*\/[\w.-]+$/;
const ARCHIVOS_DE_LOS_AGENTES = [
  'CLAUDE.md',
  '.claude/agents/develop.md',
  '.claude/agents/testing.md',
  'DIRECTRICES.md',
];
const SDK_DE_PAGO = ['openai', '@anthropic-ai/sdk', 'stripe', 'twilio'];
const GRUPOS_DE_DEPENDENCIAS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];
const RASTROS_DE_LA_PROTECCION_DE_VERCEL = ['vercel.com/login', 'Authentication Required'];
const MARCA_SIN_RELLENAR = '{{DEMO_PASSWORD}}';
const FALTA_URL_BASE = 'falta URL_BASE';
const LARGO_MAXIMO_DE_UNA_SALIDA = 200;

const bien = (detalle) => ({ ok: true, detalle });
const mal = (detalle) => ({ ok: false, detalle });

// Lo que dijo una herramienta, en una línea y sin pasar de unos cientos de letras: el veredicto
// suele estar al final.
function resumenDe(salida) {
  const texto = salida.trim().replace(/\s+/g, ' ');
  return texto.length > LARGO_MAXIMO_DE_UNA_SALIDA
    ? `…${texto.slice(-LARGO_MAXIMO_DE_UNA_SALIDA)}`
    : texto;
}

const leerPaquete = (sistema) => JSON.parse(sistema.leer('package.json'));

// Las comprobaciones: cada una recibe { sistema, urlBase, repo, contrasena } y dice si va bien.

function dependeDeNext({ sistema }) {
  const version = leerPaquete(sistema).dependencies?.next;
  return version
    ? bien(`next ${version} en las dependencias`)
    : mal('package.json no depende de next');
}

const existen =
  (...archivos) =>
  ({ sistema }) => {
    const ausentes = archivos.filter((archivo) => !sistema.existe(archivo));
    return ausentes.length === 0
      ? bien(`existen ${archivos.join(', ')}`)
      : mal(`falta ${ausentes.join(', ')}`);
  };

function commitsConClaude({ sistema }) {
  const { codigo, salida } = sistema.ejecutar('git', ['log', '--format=%b']);
  if (codigo !== 0) return mal(`git log falla: ${resumenDe(salida)}`);
  const lineas = (salida.match(/^Co-Authored-By: Claude/gim) ?? []).length;
  if (lineas === 0) return mal('ningún commit lleva Co-Authored-By: Claude');
  return bien(
    `${lineas} ${lineas === 1 ? 'línea' : 'líneas'} «Co-Authored-By: Claude» en el historial`,
  );
}

function featuresHechas({ sistema }) {
  const { codigo, salida } = sistema.ejecutar(process.execPath, ['scripts/entrega-check.mjs']);
  return codigo === 0
    ? bien(resumenDe(salida))
    : mal(`entrega-check sale con ${codigo}: ${resumenDe(salida)}`);
}

async function proceso({ sistema, urlBase }) {
  if (!urlBase) return mal(FALTA_URL_BASE);
  const { estado } = await sistema.pedir(`${urlBase}/proceso`);
  return estado === 200
    ? bien('/proceso responde 200')
    : mal(`/proceso responde ${estado}, no 200`);
}

async function loginSinCuentaDeVercel({ sistema, urlBase }) {
  if (!urlBase) return mal(FALTA_URL_BASE);
  const { estado, cuerpo } = await sistema.pedir(`${urlBase}/login`);
  const rastro = RASTROS_DE_LA_PROTECCION_DE_VERCEL.find((texto) => cuerpo.includes(texto));
  const problemas = [
    estado !== 200 && `responde ${estado}, no 200`,
    rastro !== undefined && `pide cuenta de Vercel («${rastro}» en la página)`,
  ].filter(Boolean);
  return problemas.length === 0
    ? bien('/login responde 200 sin pedir cuenta de Vercel')
    : mal(`/login ${problemas.join(' y ')}`);
}

function sinSdkDePago({ sistema }) {
  const paquete = leerPaquete(sistema);
  const usados = SDK_DE_PAGO.filter((nombre) =>
    GRUPOS_DE_DEPENDENCIAS.some((grupo) => nombre in (paquete[grupo] ?? {})),
  );
  return usados.length === 0
    ? bien(`ninguna dependencia de pago (${SDK_DE_PAGO.join(', ')})`)
    : mal(`dependencias de pago: ${usados.join(', ')}`);
}

function sinSecretosEnElHistorial({ sistema }) {
  const { codigo, salida } = sistema.ejecutar('gitleaks', ['git', '--no-banner']);
  return codigo === 0
    ? bien('gitleaks git: sin hallazgos en todo el historial')
    : mal(`gitleaks sale con ${codigo}: ${resumenDe(salida)}`);
}

function repoPublico({ sistema, repo }) {
  const { codigo, salida } = sistema.ejecutar('gh', ['repo', 'view', repo, '--json', 'visibility']);
  if (codigo !== 0) return mal(`gh repo view falla: ${resumenDe(salida)}`);
  const { visibility } = JSON.parse(salida);
  return visibility === 'PUBLIC' ? bien(`${repo} es PUBLIC`) : mal(`${repo} es ${visibility}`);
}

async function agentesLegiblesSinSesion({ sistema, repo }) {
  const respuestas = await Promise.all(
    ARCHIVOS_DE_LOS_AGENTES.map(async (archivo) => {
      const { estado } = await sistema.pedir(
        `https://raw.githubusercontent.com/${repo}/main/${archivo}`,
      );
      return { archivo, estado };
    }),
  );
  const ilegibles = respuestas
    .filter(({ estado }) => estado !== 200)
    .map(({ archivo, estado }) => `${archivo} (${estado})`);
  return ilegibles.length === 0
    ? bien(`los ${respuestas.length} .md se leen sin iniciar sesión`)
    : mal(`no se leen: ${ilegibles.join(', ')}`);
}

function readmeConLaContrasena({ sistema }) {
  return sistema.leer('README.md').includes(MARCA_SIN_RELLENAR)
    ? mal(`el README conserva el marcador ${MARCA_SIN_RELLENAR}`)
    : bien('el README ya no tiene el marcador de la contraseña');
}

function smokeDeProduccion({ sistema, urlBase, contrasena }) {
  if (!urlBase) return mal(FALTA_URL_BASE);
  if (!contrasena) return mal('falta DEMO_PASSWORD: el smoke entra con ella');
  const { codigo, salida } = sistema.ejecutar('npm', ['run', 'smoke']);
  return codigo === 0
    ? bien('npm run smoke: entran el jefe y el mecánico')
    : mal(`npm run smoke sale con ${codigo}: ${resumenDe(salida)}`);
}

// Los requisitos, con las palabras de la tabla del SPEC y en su orden.

const REQUISITOS = [
  { requisito: 'Proyecto en Next.js', comprobaciones: [dependeDeNext] },
  { requisito: 'Hecho con Claude Code', comprobaciones: [commitsConClaude] },
  {
    requisito: 'Orquestador con `CLAUDE.md` que reparte el trabajo',
    comprobaciones: [existen('CLAUDE.md')],
  },
  {
    requisito: 'Subagente Develop con su propio `.md` de cómo programar',
    comprobaciones: [existen('.claude/agents/develop.md')],
  },
  {
    requisito: 'Subagente Testing con `.md` de DIRECTRICES que Develop debe cumplir',
    comprobaciones: [existen('.claude/agents/testing.md', 'DIRECTRICES.md')],
  },
  {
    requisito: 'Testing revisa y devuelve los fallos hasta que todo pasa',
    comprobaciones: [featuresHechas],
  },
  {
    requisito: 'Base de datos gratuita: Supabase',
    aMano: 'plan Free de la organización de Supabase',
  },
  { requisito: 'Publicada gratis en Vercel', aMano: 'cuenta de Vercel en el plan Hobby' },
  {
    requisito: 'Dirección de producción pública, sin protección de Vercel',
    comprobaciones: [proceso, loginSinCuentaDeVercel],
    aMano: 'Deployment Protection desactivada en los ajustes del proyecto',
  },
  {
    requisito: 'Sin gastar dinero',
    comprobaciones: [sinSdkDePago],
    aMano: 'facturación de Supabase y de Vercel en 0',
  },
  { requisito: 'Ninguna clave de API en el repo', comprobaciones: [sinSecretosEnElHistorial] },
  {
    requisito: 'Repo de GitHub accesible, con los `.md` de los agentes',
    comprobaciones: [repoPublico, agentesLegiblesSinSesion],
  },
  {
    requisito: 'Usuario y contraseña de prueba',
    comprobaciones: [readmeConLaContrasena, smokeDeProduccion],
  },
  { requisito: 'Respuestas a 4 preguntas cortas', aMano: 'las cuatro preguntas contestadas' },
  { requisito: 'No hace falta vídeo', nota: 'no se entrega vídeo' },
];

// Evaluación, tabla y línea de comandos.

// Una comprobación que se rompe (red caída, herramienta sin instalar) ni da OK ni tumba el resto.
async function comprobar(comprobacion, contexto) {
  try {
    return await comprobacion(contexto);
  } catch (error) {
    return mal(`no se pudo comprobar: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function estadoDe(resultados, aMano) {
  if (resultados.some(({ ok }) => !ok)) return 'FALLO';
  return aMano === undefined ? 'OK' : 'A MANO';
}

async function evaluar({ requisito, comprobaciones = [], aMano, nota }, contexto) {
  const resultados = [];
  for (const comprobacion of comprobaciones) {
    resultados.push(await comprobar(comprobacion, contexto));
  }
  const detalles = [
    ...resultados.map((resultado) => resultado.detalle),
    aMano === undefined ? null : `a mano: ${aMano}`,
    nota,
  ].filter(Boolean);
  // Dos comprobaciones de una fila pueden fallar por lo mismo (la falta de URL_BASE): una vez basta.
  return {
    requisito,
    estado: estadoDe(resultados, aMano),
    detalle: [...new Set(detalles)].join('; '),
  };
}

const celda = (texto) => texto.replace(/\s+/g, ' ').replaceAll('|', '\\|');

function formatearTabla(filas) {
  return [
    '| Requisito | Estado | Detalle |',
    '|---|---|---|',
    ...filas.map(
      ({ requisito, estado, detalle }) => `| ${celda(requisito)} | ${estado} | ${celda(detalle)} |`,
    ),
  ].join('\n');
}

function resumirFilas(filas) {
  const cuantas = (estado) => filas.filter((fila) => fila.estado === estado).length;
  return `Resumen: ${cuantas('OK')} OK, ${cuantas('FALLO')} FALLO, ${cuantas('A MANO')} A MANO.`;
}

const esDireccionWeb = (texto) => URL.canParse(texto) && /^https?:$/.test(new URL(texto).protocol);

// Una barra final se quita: las comprobaciones le añaden la ruta que piden.
const sinBarraFinal = (texto) => (texto.endsWith('/') ? texto.slice(0, -1) : texto);

function leerEntorno(entorno) {
  const repo = entorno.REPO?.trim() || REPO_POR_DEFECTO;
  if (!FORMATO_DE_REPO.test(repo)) {
    return { error: `REPO tiene que ser «propietario/repositorio» y es «${repo}»` };
  }
  const urlBase = entorno.URL_BASE?.trim() ?? '';
  if (urlBase !== '' && !esDireccionWeb(urlBase)) {
    return { error: `URL_BASE tiene que ser una dirección http(s) y es «${urlBase}»` };
  }
  return { repo, urlBase: sinBarraFinal(urlBase), contrasena: entorno.DEMO_PASSWORD?.trim() ?? '' };
}

/**
 * @param {Record<string, string | undefined>} entorno
 * @param {{
 *   sistema?: typeof sistemaReal,
 *   out?: (texto: string) => unknown,
 *   err?: (texto: string) => unknown,
 * }} [opciones] sustituyen al sistema y a la salida en los tests
 * @returns {Promise<number>} el código de salida
 */
export async function main(
  entorno,
  {
    sistema = sistemaReal,
    out = (texto) => process.stdout.write(texto),
    err = (texto) => process.stderr.write(texto),
  } = {},
) {
  const lectura = leerEntorno(entorno);
  if (lectura.error) {
    err(`${lectura.error}\n${USO}\n`);
    return 2;
  }
  const filas = [];
  for (const requisito of REQUISITOS) {
    filas.push(await evaluar(requisito, { ...lectura, sistema }));
  }
  out(`${formatearTabla(filas)}\n\n${resumirFilas(filas)}\n`);
  return filas.some(({ estado }) => estado === 'FALLO') ? 1 : 0;
}

if (seEjecutaDirectamente(import.meta.url)) {
  process.exitCode = await main(process.env);
}
