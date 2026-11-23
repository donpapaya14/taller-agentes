import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('matcher del proxy', () => {
  const coincide = (ruta: string) => new RegExp(`^${config.matcher[0]}$`).test(ruta);

  it('corre en las páginas y en la ruta del cron', () => {
    const rutas = ['/', '/login', '/tablero', '/ordenes/abc', '/api/cron/restablecer'];

    expect(rutas.map(coincide)).toEqual(rutas.map(() => true));
  });

  it('no corre en los archivos estáticos de Next ni en los que tienen extensión', () => {
    const rutas = ['/_next/static/chunks/a.js', '/_next/image', '/favicon.ico', '/logo.svg'];

    expect(rutas.map(coincide)).toEqual(rutas.map(() => false));
  });
});
