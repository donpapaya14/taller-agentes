import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeEntorno } from '@/adaptadores/supabase/entorno';
import { config, proxy } from './proxy';

const { refrescarSesion } = vi.hoisted(() => ({ refrescarSesion: vi.fn() }));

vi.mock('@/adaptadores/supabase/sesion', () => ({ refrescarSesion }));

const peticion = (ruta: string) => new NextRequest(`http://localhost${ruta}`);

const sesion = (haySesion: boolean) => ({ haySesion, cookies: [], cabeceras: {} });

const sesionRenovada = {
  haySesion: true,
  cookies: [{ name: 'sb-sesion', value: 'nueva', options: { path: '/' } }],
  cabeceras: { 'Cache-Control': 'private, no-store' },
};

afterEach(() => {
  vi.resetAllMocks();
});

describe('proxy', () => {
  it('[C-1] sin sesión una ruta privada redirige a /login', async () => {
    refrescarSesion.mockResolvedValue(sesion(false));

    const respuesta = await proxy(peticion('/tablero?tarjeta=3'));

    expect(respuesta.status).toBe(307);
    expect(respuesta.headers.get('location')).toBe('http://localhost/login');
  });

  it('[C-1] con sesión /login redirige a /tablero', async () => {
    refrescarSesion.mockResolvedValue(sesion(true));

    const respuesta = await proxy(peticion('/login'));

    expect(respuesta.status).toBe(307);
    expect(respuesta.headers.get('location')).toBe('http://localhost/tablero');
  });

  it('[C-1] una ruta pública sigue su camino sin sesión', async () => {
    refrescarSesion.mockResolvedValue(sesion(false));

    const respuesta = await proxy(peticion('/proceso'));

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('x-middleware-next')).toBe('1');
  });

  it('la sesión renovada viaja en la respuesta que sigue su camino', async () => {
    refrescarSesion.mockResolvedValue(sesionRenovada);

    const respuesta = await proxy(peticion('/tablero'));

    expect(respuesta.headers.get('x-middleware-next')).toBe('1');
    expect(respuesta.cookies.get('sb-sesion')?.value).toBe('nueva');
    expect(respuesta.headers.get('cache-control')).toBe('private, no-store');
  });

  it('la sesión renovada también viaja en una redirección', async () => {
    refrescarSesion.mockResolvedValue(sesionRenovada);

    const respuesta = await proxy(peticion('/login'));

    expect(respuesta.headers.get('location')).toBe('http://localhost/tablero');
    expect(respuesta.cookies.get('sb-sesion')?.value).toBe('nueva');
    expect(respuesta.headers.get('cache-control')).toBe('private, no-store');
  });
});

// Una acción de servidor llega como POST: con JavaScript lleva la cabecera next-action; sin él, es un
// formulario normal. Redirigirla a /login la reenviaría como POST a una página que no tiene esa
// acción, y quien tenía la sesión caducada vería la pantalla de error en vez del acceso.
describe('proxy ante una acción de servidor', () => {
  const POST = (ruta: string, cabeceras: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${ruta}`, { method: 'POST', headers: cabeceras });

  const ACCION = { 'next-action': '7f1c2d3e4b5a69788796a5b4c3d2e1f0a9b8c7d6e5' };

  it.each([
    ['con JavaScript', ACCION],
    ['sin JavaScript', {}],
  ])(
    '[C-1] %s, una acción sin sesión sigue su camino: la acción pide la sesión y manda a /login',
    async (_caso, cabeceras) => {
      refrescarSesion.mockResolvedValue(sesion(false));

      const respuesta = await proxy(POST('/tablero', cabeceras));

      expect(respuesta.status).toBe(200);
      expect(respuesta.headers.get('x-middleware-next')).toBe('1');
    },
  );

  it('[C-1] con sesión, una acción lanzada desde /login tampoco se redirige a /tablero', async () => {
    refrescarSesion.mockResolvedValue(sesion(true));

    const respuesta = await proxy(POST('/login', ACCION));

    expect(respuesta.headers.get('x-middleware-next')).toBe('1');
    expect(respuesta.headers.get('location')).toBeNull();
  });

  it('la sesión renovada viaja también en la respuesta de una acción', async () => {
    refrescarSesion.mockResolvedValue(sesionRenovada);

    const respuesta = await proxy(POST('/tablero', ACCION));

    expect(respuesta.cookies.get('sb-sesion')?.value).toBe('nueva');
    expect(respuesta.headers.get('cache-control')).toBe('private, no-store');
  });

  it.each(['GET', 'HEAD'])(
    '[C-1] una petición %s sin sesión a una ruta privada se sigue orientando',
    async (metodo) => {
      refrescarSesion.mockResolvedValue(sesion(false));

      const respuesta = await proxy(
        new NextRequest('http://localhost/tablero', { method: metodo }),
      );

      expect(respuesta.status).toBe(307);
      expect(respuesta.headers.get('location')).toBe('http://localhost/login');
    },
  );
});

describe('proxy sin el entorno de Supabase', () => {
  const sinEntorno = () =>
    refrescarSesion.mockRejectedValue(
      new ErrorDeEntorno('Falta la variable de entorno SUPABASE_URL'),
    );

  it.each(['/', '/login', '/proceso', '/api/cron/restablecer'])(
    '[C-1] %s sigue su camino en vez de dar un 500',
    async (ruta) => {
      sinEntorno();

      const respuesta = await proxy(peticion(ruta));

      expect(respuesta.status).toBe(200);
      expect(respuesta.headers.get('x-middleware-next')).toBe('1');
    },
  );

  it.each(['/tablero', '/ordenes/abc', '/recambios', '/ordenes/a.b'])(
    '[C-1] %s responde 503 con un mensaje que se entiende',
    async (ruta) => {
      sinEntorno();

      const respuesta = await proxy(peticion(ruta));

      expect(respuesta.status).toBe(503);
      expect(respuesta.headers.get('content-type')).toBe('text/plain; charset=utf-8');
      expect(await respuesta.text()).toBe(
        'El servicio no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.',
      );
    },
  );

  it('[D-14] un fallo que no es del entorno no se traga', async () => {
    refrescarSesion.mockRejectedValue(new Error('la base de datos se ha roto'));

    await expect(proxy(peticion('/tablero'))).rejects.toThrow('la base de datos se ha roto');
    await expect(proxy(peticion('/proceso'))).rejects.toThrow('la base de datos se ha roto');
  });
});

describe('matcher del proxy', () => {
  const coincide = (ruta: string) => new RegExp(`^${config.matcher[0]}$`).test(ruta);

  // Las extensiones de archivo estático que el SPEC deja fuera del proxy.
  const EXTENSIONES_ESTATICAS = [
    'svg',
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp',
    'ico',
    'css',
    'js',
    'map',
    'txt',
    'xml',
    'woff2',
  ];

  it('corre en las páginas y en la ruta del cron', () => {
    const rutas = ['/', '/login', '/tablero', '/ordenes/abc', '/api/cron/restablecer'];

    expect(rutas.map(coincide)).toEqual(rutas.map(() => true));
  });

  it('[C-1] una ruta privada con punto pasa por el proxy', () => {
    expect(coincide('/ordenes/a.b')).toBe(true);
    expect(coincide('/logo.svg')).toBe(false);
  });

  it('corre en cualquier ruta con punto que no termine en una extensión estática', () => {
    const rutas = ['/ordenes/v1.2', '/recambios/a.b.c', '/ordenes/a.svg.b'];

    expect(rutas.map(coincide)).toEqual(rutas.map(() => true));
  });

  it('no corre en los archivos estáticos de Next ni en los de extensión estática', () => {
    const rutas = [
      '/_next/static/chunks/a.js',
      '/_next/image',
      '/favicon.ico',
      ...EXTENSIONES_ESTATICAS.map((extension) => `/archivo.${extension}`),
    ];

    expect(rutas.map(coincide)).toEqual(rutas.map(() => false));
  });
});
