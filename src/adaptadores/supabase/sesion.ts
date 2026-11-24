import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { cache } from 'react';
import { z } from 'zod';
import { crearClienteServidor } from './cliente-servidor';
import { leerEntorno } from './entorno';
import { opcionesDeCliente } from './opciones-cliente';
import { conPlazoTotal, esFalloDeRedOTiempo, PlazoVencido } from './tiempo-limite';

export type Sesion = {
  usuarioId: string;
  tallerId: string;
  taller: string;
  rol: 'jefe' | 'mecanico';
  nombre: string;
};

const filaDeMiembro = z.object({
  taller_id: z.string().min(1),
  rol: z.enum(['jefe', 'mecanico']),
  nombre: z.string().min(1),
  talleres: z.object({ nombre: z.string().min(1) }),
});

const SIN_TALLER = 'Tu cuenta no está asociada a ningún taller.';
const NO_SE_PUDO_LEER = 'No se pudo cargar tu taller. Inténtalo de nuevo en unos minutos.';
const FILA_INVALIDA =
  'No se entienden los datos de tu taller. Vuelve a entrar o avisa al administrador.';

// El usuario que ha entrado, o null si nadie ha entrado o Auth no ha contestado a tiempo (fallo de
// red o límite de tiempo). Cualquier otro fallo se relanza: no es «sin sesión».
async function usuarioActual(cliente: SupabaseClient): Promise<User | null> {
  try {
    const { data } = await cliente.auth.getUser();
    return data.user;
  } catch (error) {
    if (esFalloDeRedOTiempo(error)) return null;
    throw error;
  }
}

// null solo significa que nadie ha entrado (también si Auth no responde o el token no vale: se pide
// entrar de nuevo). Un usuario sin taller o con datos rotos es un error con mensaje: devolver null
// aquí lo mandaría a /login, y el proxy lo devolvería a /tablero. Lo mismo si la lectura entera
// pasa del plazo: no se sabe quién es, y el mensaje le dice que lo intente de nuevo.
async function leerSesionSinMemoria(): Promise<Sesion | null> {
  try {
    return await conPlazoTotal(leerSesionDentroDelPlazo);
  } catch (error) {
    if (error instanceof PlazoVencido) throw new Error(NO_SE_PUDO_LEER, { cause: error });
    throw error;
  }
}

// El layout y la página piden la sesión en el mismo render: con `cache` Auth se pregunta una sola
// vez por petición. Fuera de un render (acciones, rutas) `cache` no guarda nada, así que ninguna
// sesión pasa de una petición a otra.
export const leerSesion = cache(leerSesionSinMemoria);

async function leerSesionDentroDelPlazo(plazo: AbortSignal): Promise<Sesion | null> {
  const cliente = await crearClienteServidor(plazo);
  const usuario = await usuarioActual(cliente);
  if (usuario === null) return null;

  // Sin reintentos: postgrest-js reintentaría tres veces con esperas de 1, 2 y 4 s, y quien espera
  // tiene la página en blanco. Si falla, se le dice y lo intenta él.
  const { data, error } = await cliente
    .from('miembros')
    .select('taller_id, rol, nombre, talleres(nombre)')
    .eq('usuario_id', usuario.id)
    .retry(false)
    .maybeSingle();
  if (error) throw new Error(NO_SE_PUDO_LEER, { cause: error });
  if (data === null) throw new Error(SIN_TALLER);

  const fila = filaDeMiembro.safeParse(data);
  if (!fila.success) throw new Error(FILA_INVALIDA);
  const { taller_id, rol, nombre, talleres } = fila.data;
  return {
    usuarioId: usuario.id,
    tallerId: taller_id,
    taller: talleres.nombre,
    rol,
    nombre,
  };
}

type CookieARenovar = { name: string; value: string; options: CookieOptions };

// Para el proxy: Supabase renueva el token si hace falta y avisa de las cookies nuevas. Se dejan en
// la petición (para que las páginas lean ya la sesión renovada) y se devuelven para que el proxy
// las ponga en la respuesta, junto con las cabeceras de caché que Supabase exige a su lado.
// Si Auth no responde, la sesión no vale o la operación pasa del plazo cuenta como sin sesión, no
// como fallo: las páginas públicas siguen abiertas y las privadas piden entrar de nuevo. Pasado el
// plazo se devuelven igualmente las cookies que ya se habían renovado: Supabase ya dio por usado el
// token viejo y, sin ellas, el navegador se quedaría con una sesión que no sirve.
export async function refrescarSesion(peticion: NextRequest): Promise<{
  haySesion: boolean;
  cookies: CookieARenovar[];
  cabeceras: Record<string, string>;
}> {
  const { url, clavePublicable } = leerEntorno();
  const cookies: CookieARenovar[] = [];
  const cabeceras: Record<string, string> = {};
  const crearCliente = (plazo: AbortSignal) =>
    createServerClient(url, clavePublicable, {
      ...opcionesDeCliente(plazo),
      cookies: {
        getAll: () => peticion.cookies.getAll(),
        setAll: (aEscribir, cabecerasDeCache) => {
          aEscribir.forEach(({ name, value }) => peticion.cookies.set(name, value));
          cookies.push(...aEscribir);
          Object.assign(cabeceras, cabecerasDeCache);
        },
      },
    });
  try {
    const usuario = await conPlazoTotal((plazo) => usuarioActual(crearCliente(plazo)));
    return { haySesion: usuario !== null, cookies, cabeceras };
  } catch (error) {
    if (error instanceof PlazoVencido) return { haySesion: false, cookies, cabeceras };
    throw error;
  }
}
