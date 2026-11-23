import type { ServerResponse } from 'node:http';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import { proxy } from '@/proxy';
import {
  type Contestar,
  iniciarServidorFalso,
  type Peticion,
  responderJson,
} from './supabase-falso';

type Galleta = { name: string; value: string };

// next/headers solo funciona dentro de una petición de Next. Aquí cada llamada a leerSesion lleva
// sus galletas, y así varias pueden esperar a la vez.
const { galletasDeLaLlamada } = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import('node:async_hooks');
  return { galletasDeLaLlamada: new AsyncLocalStorage<Galleta[]>() };
});

vi.mock('next/headers', () => ({
  cookies: async () => {
    const galletas = galletasDeLaLlamada.getStore() ?? [];
    return { getAll: () => galletas, set: () => undefined };
  },
}));

const ID_USUARIO = '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7b64';
const ID_TALLER = '9c1e7d52-0b3a-4f68-8a2d-6e4b1c7f3a90';
const NO_SE_PUDO_LEER = 'No se pudo cargar tu taller. Inténtalo de nuevo en unos minutos.';

// Lo que se exige a una operación con Supabase caído: acabar en 5 s como mucho.
const PLAZO_MAXIMO_MS = 5000;
// Si el plazo no funciona, la operación tarda unos 30 s: se espera lo bastante para medirlo y
// fallar con la cifra en vez de con un tiempo agotado.
const TIEMPO_PARA_FALLAR_MS = 45_000;

// Cómo contesta el servidor falso en cada ruta: bien, no contesta nunca, responde 503 o responde
// bien pasados tantos milisegundos.
type Modo = 'responde' | 'cuelga' | 'rechaza' | number;
type Rutas = { refresco: Modo; usuario: Modo; miembros: Modo };

const TODO_RESPONDE: Rutas = { refresco: 'responde', usuario: 'responde', miembros: 'responde' };

// Cada escenario es un usuario con sus tokens: el servidor falso lo reconoce por el token y así
// todos pueden correr a la vez contra el mismo servidor.
const ESCENARIOS: Record<string, Rutas> = {
  'proxy-todo-responde': TODO_RESPONDE,
  'proxy-refresco-cuelga': { ...TODO_RESPONDE, refresco: 'cuelga' },
  'proxy-refresco-rechaza': { ...TODO_RESPONDE, refresco: 'rechaza' },
  'sesion-todo-responde': TODO_RESPONDE,
  'sesion-miembros-rechaza': { ...TODO_RESPONDE, miembros: 'rechaza' },
  'sesion-auth-lento-miembros-cuelga': { ...TODO_RESPONDE, usuario: 3000, miembros: 'cuelga' },
  'sesion-refresco-cuelga': { ...TODO_RESPONDE, refresco: 'cuelga' },
};

const RUTAS: Record<string, keyof Rutas> = {
  'POST /auth/v1/token': 'refresco',
  'GET /auth/v1/user': 'usuario',
  'GET /rest/v1/miembros': 'miembros',
};

const segundosActuales = () => Math.floor(Date.now() / 1000);

const tokensDe = (nombre: string, expiraEnSegundos: number) => ({
  access_token: nombre,
  refresh_token: nombre,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: segundosActuales() + expiraEnSegundos,
});

const USUARIO = {
  id: ID_USUARIO,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'jefe@tallerdemo.example',
};

const FILA_DE_MIEMBRO = [
  { taller_id: ID_TALLER, rol: 'jefe', nombre: 'Marta', talleres: { nombre: 'Taller Demo' } },
];

const cuerpoDe = (ruta: keyof Rutas, nombre: string) =>
  ({
    refresco: { ...tokensDe(nombre, 3600), user: USUARIO },
    usuario: USUARIO,
    miembros: FILA_DE_MIEMBRO,
  })[ruta];

// El access token viaja en Authorization y el refresh token en el cuerpo de /token.
function escenarioDe({ metodo, ruta, cuerpo, cabeceras }: Peticion): string {
  if (metodo === 'POST' && ruta === '/auth/v1/token') {
    return (JSON.parse(cuerpo) as { refresh_token: string }).refresh_token;
  }
  return (cabeceras.authorization ?? '').replace('Bearer ', '');
}

function aplicar(modo: Modo, respuesta: ServerResponse, cuerpo: unknown): void {
  if (modo === 'cuelga') return;
  if (modo === 'rechaza') return responderJson(respuesta, 503, { message: 'Service Unavailable' });
  const responder = () => responderJson(respuesta, 200, cuerpo);
  if (modo === 'responde') responder();
  else setTimeout(responder, modo);
}

const contestar: Contestar = (peticion, respuesta) => {
  const nombre = escenarioDe(peticion);
  const ruta = RUTAS[`${peticion.metodo} ${peticion.ruta}`];
  const modo = ruta ? ESCENARIOS[nombre]?.[ruta] : undefined;
  if (modo === undefined) return responderJson(respuesta, 404, { message: 'ruta desconocida' });
  aplicar(modo, respuesta, cuerpoDe(ruta, nombre));
};

let servidor: Awaited<ReturnType<typeof iniciarServidorFalso>>;

// La sesión que Supabase deja en la cookie `sb-<proyecto>-auth-token`, en el formato de @supabase/ssr.
function galletaDe(nombre: string, caducada: boolean): Galleta {
  const sesion = tokensDe(nombre, caducada ? -3600 : 3600);
  return {
    name: `sb-${new URL(servidor.url).hostname.split('.')[0]}-auth-token`,
    value: `base64-${Buffer.from(JSON.stringify(sesion)).toString('base64url')}`,
  };
}

function peticionDe(ruta: string, nombre: string, caducada: boolean) {
  const { name, value } = galletaDe(nombre, caducada);
  return new NextRequest(`http://localhost${ruta}`, { headers: { cookie: `${name}=${value}` } });
}

const leer = (nombre: string, caducada: boolean) =>
  galletasDeLaLlamada.run([galletaDe(nombre, caducada)], () => leerSesion());

const llamadasA = (nombre: string, destino: string) =>
  servidor.peticiones.filter(
    (p) => escenarioDe(p) === nombre && `${p.metodo} ${p.ruta}` === destino,
  ).length;

// Cuánto tarda la operación, acabe bien o mal.
async function medir<T>(operacion: () => Promise<T>) {
  const inicio = performance.now();
  const [resultado] = await Promise.allSettled([operacion()]);
  return { resultado, ms: performance.now() - inicio };
}

function valorDe<T>(resultado: PromiseSettledResult<T>): T {
  if (resultado.status === 'rejected') throw resultado.reason;
  return resultado.value;
}

beforeAll(async () => {
  servidor = await iniciarServidorFalso(contestar);
  vi.stubEnv('SUPABASE_URL', servidor.url);
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'clave-publicable');
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await servidor.cerrar();
});

// Sin describe: los bloques se ejecutan uno tras otro y los tiempos de los escenarios se sumarían.
// Todos a la vez cuestan lo que el más lento.
it.concurrent(
  'el proxy renueva el token caducado y deja pasar cuando Supabase responde',
  async () => {
    const entrante = peticionDe('/tablero', 'proxy-todo-responde', true);

    const respuesta = await proxy(entrante);

    expect(respuesta.headers.get('x-middleware-next')).toBe('1');
    const { name, value } = galletaDe('proxy-todo-responde', true);
    expect(respuesta.cookies.get(name)?.value).not.toBe(value);
  },
);

it.concurrent(
  '[C-1][D-14] el proxy con el token caducado y Auth colgado acaba en 5 s, manda a /login y no toca la sesión',
  async () => {
    const entrante = peticionDe('/tablero', 'proxy-refresco-cuelga', true);

    const { resultado, ms } = await medir(() => proxy(entrante));

    expect(ms).toBeLessThanOrEqual(PLAZO_MAXIMO_MS);
    const respuesta = valorDe(resultado);
    expect(respuesta.status).toBe(307);
    expect(respuesta.headers.get('location')).toBe('http://localhost/login');
    expect(respuesta.cookies.getAll()).toEqual([]);
  },
  TIEMPO_PARA_FALLAR_MS,
);

it.concurrent(
  '[D-14] el proxy con el token caducado y Auth rechazando acaba en 5 s también en una ruta pública y la deja pasar',
  async () => {
    const entrante = peticionDe('/proceso', 'proxy-refresco-rechaza', true);

    const { resultado, ms } = await medir(() => proxy(entrante));

    expect(ms).toBeLessThanOrEqual(PLAZO_MAXIMO_MS);
    expect(valorDe(resultado).headers.get('x-middleware-next')).toBe('1');
  },
  TIEMPO_PARA_FALLAR_MS,
);

it.concurrent('leerSesion devuelve la sesión cuando Supabase responde', async () => {
  expect(await leer('sesion-todo-responde', false)).toEqual({
    usuarioId: ID_USUARIO,
    tallerId: ID_TALLER,
    taller: 'Taller Demo',
    rol: 'jefe',
    nombre: 'Marta',
  });
});

it.concurrent(
  '[D-14] leerSesion con la consulta de miembros rechazada no reintenta y avisa',
  async () => {
    const { resultado, ms } = await medir(() => leer('sesion-miembros-rechaza', false));

    expect(ms).toBeLessThanOrEqual(PLAZO_MAXIMO_MS);
    expect(resultado).toMatchObject({ status: 'rejected', reason: { message: NO_SE_PUDO_LEER } });
    expect(llamadasA('sesion-miembros-rechaza', 'GET /rest/v1/miembros')).toBe(1);
  },
  TIEMPO_PARA_FALLAR_MS,
);

it.concurrent(
  '[D-14] leerSesion con Auth lento y la consulta colgada: el plazo es de toda la operación, no de cada llamada',
  async () => {
    const nombre = 'sesion-auth-lento-miembros-cuelga';

    const { resultado, ms } = await medir(() => leer(nombre, false));

    expect(ms).toBeLessThanOrEqual(PLAZO_MAXIMO_MS);
    expect(resultado).toMatchObject({ status: 'rejected', reason: { message: NO_SE_PUDO_LEER } });
    expect(llamadasA(nombre, 'GET /rest/v1/miembros')).toBe(1);
  },
  TIEMPO_PARA_FALLAR_MS,
);

it.concurrent(
  '[D-14] leerSesion con el token caducado y Auth colgado acaba en 5 s y avisa',
  async () => {
    const { resultado, ms } = await medir(() => leer('sesion-refresco-cuelga', true));

    expect(ms).toBeLessThanOrEqual(PLAZO_MAXIMO_MS);
    expect(resultado).toMatchObject({ status: 'rejected', reason: { message: NO_SE_PUDO_LEER } });
  },
  TIEMPO_PARA_FALLAR_MS,
);
