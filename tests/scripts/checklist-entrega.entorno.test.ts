import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { sistemaReal } from '../../scripts/checklist-entrega.mjs';
import {
  COMANDOS,
  CONTRASENA,
  ENTORNO_COMPLETO,
  R,
  REPO,
  URL_BASE,
  correr,
  filaDe,
  mundoEnVerde,
  rawDe,
} from '../apoyo/checklist-falso';

describe('checklist de entrega: el entorno', () => {
  it('sin URL_BASE fallan las comprobaciones de la web y no se lanza el smoke', async () => {
    const entorno = { REPO, DEMO_PASSWORD: CONTRASENA };

    const { codigo, filas, llamadas } = await correr(mundoEnVerde(), entorno);

    expect(codigo).toBe(1);
    expect(filaDe(filas, R.publica)?.detalle).toContain('falta URL_BASE');
    expect(filaDe(filas, R.usuario)?.detalle).toContain('falta URL_BASE');
    expect(llamadas).not.toContain(COMANDOS.smoke);
  });

  it('cuando dos comprobaciones de una fila fallan por lo mismo, el motivo sale una vez', async () => {
    const entorno = { REPO, DEMO_PASSWORD: CONTRASENA };

    const { filas } = await correr(mundoEnVerde(), entorno);

    expect(filaDe(filas, R.publica)?.detalle.split('falta URL_BASE')).toHaveLength(2);
  });

  it('sin DEMO_PASSWORD no se lanza el smoke y dice qué falta', async () => {
    const entorno = { URL_BASE, REPO };

    const { filas, llamadas } = await correr(mundoEnVerde(), entorno);

    expect(filaDe(filas, R.usuario)).toMatchObject({ estado: 'FALLO' });
    expect(filaDe(filas, R.usuario)?.detalle).toContain('falta DEMO_PASSWORD');
    expect(llamadas).not.toContain(COMANDOS.smoke);
  });

  it('sin REPO mira donpapaya14/taller-agentes', async () => {
    const entorno = { URL_BASE, DEMO_PASSWORD: CONTRASENA };

    const { codigo, llamadas } = await correr(mundoEnVerde(), entorno);

    expect(codigo).toBe(0);
    expect(llamadas).toContain(COMANDOS.ghRepoView);
  });

  it('una barra al final de URL_BASE no cambia las direcciones que se piden', async () => {
    const entorno = { ...ENTORNO_COMPLETO, URL_BASE: `${URL_BASE}/` };

    const { codigo, llamadas } = await correr(mundoEnVerde(), entorno);

    expect(codigo).toBe(0);
    expect(llamadas).toContain(`GET ${URL_BASE}/proceso`);
    expect(llamadas).toContain(`GET ${URL_BASE}/login`);
  });
});

describe('checklist de entrega: un entorno mal formado', () => {
  it.each(['--help', 'sin-barra', 'a/b/c', '../etc', 'dueño/repo con espacios'])(
    'un REPO como «%s» es un error de uso: sale con 2 y no lanza nada',
    async (repo) => {
      const entorno = { ...ENTORNO_COMPLETO, REPO: repo };

      const { codigo, errores, llamadas } = await correr(mundoEnVerde(), entorno);

      expect(codigo).toBe(2);
      expect(errores).toContain('REPO');
      expect(llamadas).toEqual([]);
    },
  );

  it.each(['taller-agentes.vercel.app', 'file:///srv/taller', 'no es una dirección'])(
    'una URL_BASE como «%s» es un error de uso: sale con 2 y no lanza nada',
    async (urlBase) => {
      const entorno = { ...ENTORNO_COMPLETO, URL_BASE: urlBase };

      const { codigo, errores, llamadas } = await correr(mundoEnVerde(), entorno);

      expect(codigo).toBe(2);
      expect(errores).toContain('URL_BASE');
      expect(llamadas).toEqual([]);
    },
  );
});

describe('checklist de entrega: lo que no se puede comprobar no da OK', () => {
  it('si falla la red, la fila sale FALLO con el motivo y el resto sigue', async () => {
    const mundo = mundoEnVerde();
    mundo.paginas[`${URL_BASE}/proceso`] = new Error('getaddrinfo ENOTFOUND taller-agentes');

    const { codigo, filas } = await correr(mundo);

    expect(codigo).toBe(1);
    expect(filaDe(filas, R.publica)?.detalle).toContain('ENOTFOUND');
    expect(filaDe(filas, R.next)).toMatchObject({ estado: 'OK' });
  });

  it('una herramienta que no está instalada sale FALLO, nunca OK', async () => {
    const mundo = mundoEnVerde();
    delete mundo.comandos[COMANDOS.gitleaks];

    const { filas } = await correr(mundo);

    expect(filaDe(filas, R.claves)).toMatchObject({ estado: 'FALLO' });
    expect(filaDe(filas, R.claves)?.detalle).toContain('gitleaks');
  });

  it('una respuesta de gh que no es JSON sale FALLO con el motivo', async () => {
    const mundo = mundoEnVerde();
    mundo.comandos[COMANDOS.ghRepoView] = { codigo: 0, salida: 'no soy json' };

    const { filas } = await correr(mundo);

    expect(filaDe(filas, R.repo)).toMatchObject({ estado: 'FALLO' });
    expect(filaDe(filas, R.repo)?.detalle).toContain('no se pudo comprobar');
  });
});

describe('checklist de entrega: la protección de Vercel', () => {
  const PROTEGIDAS = [
    ['/proceso con una redirección', '/proceso', { estado: 307, cuerpo: '' }, '307'],
    ['/login con un 401', '/login', { estado: 401, cuerpo: 'Authentication Required' }, '401'],
    [
      '/login que enlaza al acceso de Vercel',
      '/login',
      { estado: 200, cuerpo: '<a href="https://vercel.com/login?next=/">' },
      'vercel.com/login',
    ],
  ] as const;

  it.each(PROTEGIDAS)('FALLO con %s', async (_, ruta, respuesta, texto) => {
    const mundo = mundoEnVerde();
    mundo.paginas[`${URL_BASE}${ruta}`] = respuesta;

    const { codigo, filas } = await correr(mundo);

    expect(codigo).toBe(1);
    expect(filaDe(filas, R.publica)).toMatchObject({ estado: 'FALLO' });
    expect(filaDe(filas, R.publica)?.detalle).toContain(texto);
  });

  it('FALLO si un .md del repo no se lee sin sesión, y dice cuál', async () => {
    const mundo = mundoEnVerde();
    mundo.paginas[rawDe('DIRECTRICES.md')] = { estado: 404, cuerpo: 'Not Found' };

    const { filas } = await correr(mundo);

    expect(filaDe(filas, R.repo)).toMatchObject({ estado: 'FALLO' });
    expect(filaDe(filas, R.repo)?.detalle).toContain('DIRECTRICES.md (404)');
  });
});

type Atencion = { estado: number; cabeceras?: Record<string, string>; cuerpo?: string };

// Un servidor de verdad en un puerto libre mientras dura `usar`.
async function conServidor<T>(
  atender: (url: string) => Atencion,
  usar: (direccion: string) => Promise<T>,
): Promise<T> {
  const servidor = createServer((peticion, respuesta) => {
    const { estado, cabeceras, cuerpo } = atender(peticion.url ?? '/');
    respuesta.writeHead(estado, cabeceras);
    respuesta.end(cuerpo ?? '');
  });
  servidor.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  try {
    return await usar(`http://127.0.0.1:${(servidor.address() as AddressInfo).port}`);
  } finally {
    servidor.closeAllConnections();
    servidor.close();
  }
}

describe('checklist de entrega: el sistema de verdad', () => {
  it('pedir no sigue las redirecciones: da el 307 y no la página a la que lleva', async () => {
    const respuesta = await conServidor(
      (url) =>
        url === '/destino'
          ? { estado: 200, cuerpo: 'la página de acceso' }
          : { estado: 307, cabeceras: { Location: '/destino' } },
      (direccion) => sistemaReal.pedir(`${direccion}/login`),
    );

    expect(respuesta.estado).toBe(307);
  });

  it('pedir devuelve el estado y el cuerpo de una página', async () => {
    const respuesta = await conServidor(
      () => ({ estado: 200, cuerpo: '<h1>Proceso</h1>' }),
      (direccion) => sistemaReal.pedir(`${direccion}/proceso`),
    );

    expect(respuesta).toEqual({ estado: 200, cuerpo: '<h1>Proceso</h1>' });
  });

  it('ejecutar da el código de salida y lo que escribió el comando', () => {
    const resultado = sistemaReal.ejecutar(process.execPath, [
      '-e',
      'process.stdout.write("hola"); process.exit(3)',
    ]);

    expect(resultado).toEqual({ codigo: 3, salida: 'hola' });
  });

  it('ejecutar un comando que no existe sale con un código distinto de 0 y dice por qué', () => {
    const resultado = sistemaReal.ejecutar('comando-que-no-existe-foso', []);

    expect(resultado.codigo).not.toBe(0);
    expect(resultado.salida).toContain('ENOENT');
  });

  it('existe y leer miran el repo', () => {
    expect(sistemaReal.existe('package.json')).toBe(true);
    expect(sistemaReal.existe('no-existe.json')).toBe(false);
    expect(JSON.parse(sistemaReal.leer('package.json'))).toHaveProperty('name', 'taller-agentes');
  });
});
